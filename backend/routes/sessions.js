const express = require('express');

const router = express.Router();

// ── In-Memory Session Store ──────────────────────────────────────────────────
// Maps sessionId -> { sessionId, status, startedAt, endedAt }
const sessions = new Map();

// ── POST /api/sessions ────────────────────────────────────────────────────────
// Creates a new assessment session
router.post('/', (req, res) => {
  try {
    const { sessionId } = req.body || {};

    // Basic validation
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required and must be a non-empty string'
      });
    }

    const trimmedId = sessionId.trim();

    // Check for duplicate session
    if (sessions.has(trimmedId)) {
      return res.status(409).json({
        success: false,
        error: `Session with ID '${trimmedId}' already exists`
      });
    }

    const newSession = {
      sessionId: trimmedId,
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null
    };

    sessions.set(trimmedId, newSession);

    return res.status(201).json({
      success: true,
      session: newSession
    });
  } catch (err) {
    console.error('Error creating session:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while creating session'
    });
  }
});

// ── GET /api/sessions/:sessionId ─────────────────────────────────────────────
// Retrieves an existing assessment session by ID
router.get('/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessions.has(sessionId)) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    return res.status(200).json({
      success: true,
      session: sessions.get(sessionId)
    });
  } catch (err) {
    console.error('Error fetching session:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while retrieving session'
    });
  }
});

// ── PATCH /api/sessions/:sessionId/end ───────────────────────────────────────
// Marks an assessment session as completed
router.patch('/:sessionId/end', (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessions.has(sessionId)) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const session = sessions.get(sessionId);
    session.status = 'completed';
    session.endedAt = new Date().toISOString();

    sessions.set(sessionId, session);

    return res.status(200).json({
      success: true,
      session
    });
  } catch (err) {
    console.error('Error ending session:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while ending session'
    });
  }
});

module.exports = router;
module.exports.sessions = sessions;
