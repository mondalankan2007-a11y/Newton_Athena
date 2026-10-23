/**
 * Screenshot Capture Service
 *
 * Captures screenshot frames from an explicitly selected screen-sharing MediaStream
 * and compresses them into JPEG Blobs suitable for transmission or preview.
 *
 * Privacy & Performance Guarantees:
 * - Only uses the provided screen-sharing MediaStream (never requests new permissions).
 * - Never touches or captures the camera stream.
 * - Never stops the original screen MediaStream or any of its tracks.
 * - Cleans up all temporary video and canvas elements immediately.
 * - Compresses to JPEG Blob at ~0.65 quality (type: "image/jpeg").
 * - Does NOT save permanent files to disk or keep historical blobs in memory.
 */

// JPEG compression quality between 0.6 and 0.7
const JPEG_COMPRESSION_QUALITY = 0.65;

/**
 * Captures a single screenshot from the user's active screen-sharing stream.
 * Converts the frame to a compressed JPEG Blob.
 *
 * @param {MediaStream} screenStream - The active screen MediaStream from getDisplayMedia()
 * @returns {Promise<Blob>} A promise that resolves with the JPEG Blob (type: "image/jpeg")
 */
export async function captureScreenshot(screenStream) {
  // 1. Validate MediaStream
  if (!screenStream || typeof screenStream.getVideoTracks !== 'function') {
    throw new Error('Invalid screen MediaStream: stream is missing or invalid.');
  }

  // 2. Find the active video track
  const videoTracks = screenStream.getVideoTracks();
  const activeTrack = videoTracks.find((track) => track.readyState === 'live');

  if (!activeTrack) {
    throw new Error('No active video track found in screen stream.');
  }

  // 3. Create a temporary video element
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  try {
    // 4. Attach existing screen stream
    video.srcObject = screenStream;

    // 5. Wait until the video is ready to render frames
    await new Promise((resolve, reject) => {
      // If video dimensions and readyState are already satisfied
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
        return;
      }

      // Safety timeout: abort if video does not become ready within 2.5 seconds
      const timeoutId = setTimeout(() => {
        cleanupListeners();
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
        } else {
          reject(new Error('Screenshot capture timed out waiting for video frame.'));
        }
      }, 2500);

      function onReady() {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          cleanupListeners();
          clearTimeout(timeoutId);
          resolve();
        }
      }

      function onError(err) {
        cleanupListeners();
        clearTimeout(timeoutId);
        reject(err || new Error('Temporary video element encountered an error.'));
      }

      function cleanupListeners() {
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('error', onError);
      }

      video.addEventListener('loadeddata', onReady);
      video.addEventListener('canplay', onReady);
      video.addEventListener('loadedmetadata', onReady);
      video.addEventListener('error', onError);

      // Trigger play to ensure frame decoding starts
      video.play().catch(() => {});
    });

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      throw new Error('Screen video dimensions are invalid or zero.');
    }

    // 6. Create a canvas using the video's dimensions
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D rendering context on canvas.');
    }

    // 7. Draw the current screen frame onto the canvas
    ctx.drawImage(video, 0, 0, width, height);

    // 8. Convert the canvas to a compressed JPEG Blob (quality 0.65)
    const blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (resultBlob) => {
            if (resultBlob && resultBlob.type === 'image/jpeg') {
              resolve(resultBlob);
            } else if (resultBlob) {
              // Ensure Blob has explicit type image/jpeg
              const jpegBlob = resultBlob.slice(0, resultBlob.size, 'image/jpeg');
              resolve(jpegBlob);
            } else {
              reject(new Error('Canvas toBlob returned null: failed to compress screenshot.'));
            }
          },
          'image/jpeg',
          JPEG_COMPRESSION_QUALITY
        );
      } catch (err) {
        reject(err);
      }
    });

    // Clean up canvas dimensions to free memory
    canvas.width = 0;
    canvas.height = 0;

    // 9. Return the JPEG Blob
    return blob;
  } finally {
    // 10. Clean up the temporary video element
    // NEVER stop the original screen MediaStream or its track!
    try {
      video.pause();
    } catch (_) {}
    video.srcObject = null;
    try {
      video.load();
    } catch (_) {}
    video.remove();
  }
}

/**
 * Calculates screenshot size in bytes and kilobytes from a Blob.
 *
 * @param {Blob} blob - The captured screenshot Blob
 * @returns {{ bytes: number, kilobytes: number }}
 */
export function getScreenshotSize(blob) {
  if (!blob || typeof blob.size !== 'number') {
    return { bytes: 0, kilobytes: 0 };
  }
  const bytes = blob.size;
  const kilobytes = Number((bytes / 1024).toFixed(2));
  return { bytes, kilobytes };
}

/**
 * Formats a byte count into a user-readable string (e.g. "125 KB", "1.24 MB").
 *
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) {
    return '0 KB';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${parseFloat(mb.toFixed(2))} MB`;
  }
  const gb = mb / 1024;
  return `${parseFloat(gb.toFixed(2))} GB`;
}
