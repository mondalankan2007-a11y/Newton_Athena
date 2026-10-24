const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sessions } = require('./sessions');

const router = express.Router();

// Root directory for uploaded screenshots
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads', 'screenshots');

// In-memory screenshot metadata store: Map<sessionId, Array<ScreenshotMetadata>>
const screenshotMetadata = new Map();

// Maximum allowed screenshot file size: 2 MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Middleware: Validates that the requested assessment session exists in memory.
 * Returns 404 if the session does not exist.
 */
function validateSession(req, res, next) {
  const { sessionId } = req.params;

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(404).json({
      error: 'Session not found'
    });
  }

  next();
}

/**
 * Multer disk storage configuration:
 * - Saves screenshots in backend/uploads/screenshots/<sessionId>/
 * - Generates safe, sequential filenames (e.g. screenshot-000001.jpg)
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const { sessionId } = req.params;
      // Sanitize folder name to prevent any path traversal
      const safeDirName = path.basename(sessionId).replace(/[^a-zA-Z0-9_-]/g, '');
      const sessionDir = path.join(UPLOADS_ROOT, safeDirName);

      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      cb(null, sessionDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const { sessionId } = req.params;
    const sessionList = screenshotMetadata.get(sessionId) || [];
    const sequenceNum = sessionList.length + 1;
    const filename = `screenshot-${String(sequenceNum).padStart(6, '0')}.jpg`;
    cb(null, filename);
  }
});

/**
 * File filter: Restrict uploads strictly to image/jpeg.
 */
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    const err = new Error('Invalid file type: only image/jpeg is allowed');
    err.code = 'INVALID_MIME_TYPE';
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
}).single('screenshot');

/**
 * Middleware wrapper for multer error handling:
 * Translates file size limits to 413, invalid types to 400, and missing files to 400.
 */
function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'Screenshot exceeds maximum size limit of 2 MB'
        });
      }
      if (err.code === 'INVALID_MIME_TYPE') {
        return res.status(400).json({
          error: 'Invalid file type: only image/jpeg is allowed'
        });
      }
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          error: err.message || 'Malformed multipart request'
        });
      }
      return res.status(400).json({
        error: err.message || 'File upload failed'
      });
    }

    // Verify screenshot file was attached in the request
    if (!req.file) {
      return res.status(400).json({
        error: 'Screenshot file is required (field name: screenshot)'
      });
    }

    next();
  });
}

// ── 1. POST /api/sessions/:sessionId/screenshots ─────────────────────────────
// Uploads and stores a new JPEG screenshot for an active session with validated metadata
router.post('/:sessionId/screenshots', validateSession, handleUpload, (req, res) => {
  const cleanupFile = () => {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
  };

  try {
    const { sessionId } = req.params;
    const body = req.body || {};

    // 1. Validate sessionId matches req.params.sessionId (Requirement 3)
    if (body.sessionId !== undefined && body.sessionId !== null) {
      if (typeof body.sessionId !== 'string' || body.sessionId.trim() !== sessionId) {
        cleanupFile();
        return res.status(400).json({
          error: 'Session ID mismatch'
        });
      }
    }

    // 2. Validate sequence number: positive integer (Requirement 4)
    if (body.sequence === undefined || body.sequence === null || body.sequence === '') {
      cleanupFile();
      return res.status(400).json({
        error: 'Sequence number is required and must be a positive integer'
      });
    }

    const sequenceNum = Number(body.sequence);
    if (!Number.isInteger(sequenceNum) || sequenceNum <= 0) {
      cleanupFile();
      return res.status(400).json({
        error: 'Invalid sequence: must be a positive integer greater than 0'
      });
    }

    // 3. Validate capturedAt timestamp: valid ISO timestamp (Requirement 5)
    if (!body.capturedAt || typeof body.capturedAt !== 'string') {
      cleanupFile();
      return res.status(400).json({
        error: 'capturedAt is required and must be a valid ISO timestamp'
      });
    }

    const parsedDate = new Date(body.capturedAt);
    if (isNaN(parsedDate.getTime()) || !body.capturedAt.includes('T')) {
      cleanupFile();
      return res.status(400).json({
        error: 'Invalid capturedAt timestamp format. Must be a valid ISO 8601 string'
      });
    }

    // 4. Validate MIME type: must be image/jpeg and match uploaded file (Requirement 6)
    if (body.mimeType && body.mimeType !== 'image/jpeg') {
      cleanupFile();
      return res.status(400).json({
        error: 'Invalid MIME type in metadata: only image/jpeg is allowed'
      });
    }

    if (req.file.mimetype !== 'image/jpeg') {
      cleanupFile();
      return res.status(400).json({
        error: 'Invalid file MIME type: only image/jpeg is allowed'
      });
    }

    const sessionList = screenshotMetadata.get(sessionId) || [];
    const nextId = sessionList.length + 1;
    const receivedAt = new Date().toISOString();

    // 5. Store metadata in memory (Requirement 7 & 8)
    const metadata = {
      id: nextId,
      sessionId,
      sequence: sequenceNum,
      capturedAt: body.capturedAt,
      receivedAt,
      filename: req.file.filename,
      size: req.file.size,
      mimeType: 'image/jpeg'
    };

    sessionList.push(metadata);
    screenshotMetadata.set(sessionId, sessionList);

    return res.status(201).json({
      success: true,
      screenshot: metadata
    });
  } catch (err) {
    cleanupFile();
    console.error('Error storing screenshot metadata:', err);
    return res.status(500).json({
      error: 'Internal server error while saving screenshot'
    });
  }
});

// ── 2. GET /api/sessions/:sessionId/screenshots/stats ─────────────────────────
// Returns aggregate screenshot count, total bytes, firstCapturedAt, and lastCapturedAt
router.get('/:sessionId/screenshots/stats', validateSession, (req, res) => {
  try {
    const { sessionId } = req.params;
    const screenshots = screenshotMetadata.get(sessionId) || [];
    const totalBytes = screenshots.reduce((sum, item) => sum + (item.size || 0), 0);

    const firstCapturedAt = screenshots.length > 0 ? screenshots[0].capturedAt : null;
    const lastCapturedAt = screenshots.length > 0 ? screenshots[screenshots.length - 1].capturedAt : null;

    return res.status(200).json({
      sessionId,
      count: screenshots.length,
      totalBytes,
      firstCapturedAt,
      lastCapturedAt
    });
  } catch (err) {
    console.error('Error fetching screenshot stats:', err);
    return res.status(500).json({
      error: 'Internal server error while calculating screenshot statistics'
    });
  }
});

// ── 3. GET /api/sessions/:sessionId/screenshots ───────────────────────────────
// Returns list of all screenshot metadata records for a session (without binary images)
router.get('/:sessionId/screenshots', validateSession, (req, res) => {
  try {
    const { sessionId } = req.params;
    const screenshots = screenshotMetadata.get(sessionId) || [];

    return res.status(200).json({
      sessionId,
      count: screenshots.length,
      screenshots
    });
  } catch (err) {
    console.error('Error fetching screenshots metadata:', err);
    return res.status(500).json({
      error: 'Internal server error while retrieving screenshot metadata'
    });
  }
});

module.exports = router;
module.exports.screenshotMetadata = screenshotMetadata;
