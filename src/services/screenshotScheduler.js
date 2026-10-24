/**
 * Screenshot Scheduler Service
 *
 * Manages an automatic screenshot loop that captures a frame from the user's
 * screen-sharing stream every 1000 milliseconds (1 FPS).
 *
 * Reliability Features (Commit 17):
 * - Exactly 1000ms recurring interval.
 * - Single-instance guarantee: startScreenshotCapture guards against duplicate timers.
 * - Overlap protection: skips concurrent capture if a frame is already being converted.
 * - Sequence tracking: increments monotonically (1, 2, 3...) per successful capture.
 * - Sequence reset helper: resets to 0 only when a new assessment session begins.
 * - Immediate clean teardown on stop or stream end.
 */

import { captureScreenshot } from './screenshotService.js';

let screenshotIntervalId = null;
let isCapturingInProgress = false;
let isSchedulerRunning = false;
let activeScreenStream = null;
let screenshotCallback = null;
let errorCallback = null;
let sequenceCounter = 0;

/**
 * Resets the sequence counter to 0 (called when a new session starts).
 */
export function resetScreenshotSequence() {
  sequenceCounter = 0;
}

/**
 * Gets the current sequence counter value.
 * @returns {number}
 */
export function getScreenshotSequence() {
  return sequenceCounter;
}

/**
 * Checks if the given stream has an active, live video track.
 *
 * @param {MediaStream} stream
 * @returns {boolean}
 */
function isStreamTrackLive(stream) {
  if (!stream || typeof stream.getVideoTracks !== 'function') return false;
  const tracks = stream.getVideoTracks();
  return tracks.some((track) => track.readyState === 'live');
}

/**
 * Executes a single screenshot tick.
 * Prevents overlapping captures if a previous capture is still executing.
 */
async function captureTick() {
  if (!isSchedulerRunning) return;

  // Prevent overlapping captures
  if (isCapturingInProgress) {
    return;
  }

  // Check if screen stream is still available and live
  if (!isStreamTrackLive(activeScreenStream)) {
    stopScreenshotCapture();
    if (typeof errorCallback === 'function') {
      errorCallback(new Error('Screen sharing stream ended or has no active tracks.'));
    }
    return;
  }

  isCapturingInProgress = true;

  try {
    const blob = await captureScreenshot(activeScreenStream);

    // Only deliver if scheduler is still running
    if (isSchedulerRunning && typeof screenshotCallback === 'function') {
      sequenceCounter += 1;
      const metadata = {
        sequence: sequenceCounter,
        capturedAt: new Date().toISOString(),
        size: blob ? blob.size : 0,
      };
      screenshotCallback(blob, metadata);
    }
  } catch (err) {
    if (isSchedulerRunning && typeof errorCallback === 'function') {
      errorCallback(err);
    }

    // If capture failed because stream track ended, stop scheduler
    if (!isStreamTrackLive(activeScreenStream)) {
      stopScreenshotCapture();
    }
  } finally {
    isCapturingInProgress = false;
  }
}

/**
 * Starts automatic screenshot capture every 1000 milliseconds.
 * Prevents duplicate timers: if already running with the same stream, avoids creating a new timer.
 * If restarting with a new stream, stops the old timer first.
 *
 * @param {MediaStream} screenStream - Explicitly selected screen-sharing MediaStream
 * @param {Function} onScreenshot - Callback receiving each captured JPEG Blob and metadata: (blob, metadata) => void
 * @param {Function} [onError] - Optional callback receiving any capture errors: (error) => void
 */
export function startScreenshotCapture(screenStream, onScreenshot, onError) {
  if (!isStreamTrackLive(screenStream)) {
    if (typeof onError === 'function') {
      onError(new Error('Cannot start capture: screen stream is missing or has ended.'));
    }
    return;
  }

  // If already running with the exact same stream, do nothing to prevent duplicate timers
  if (isSchedulerRunning && activeScreenStream === screenStream && screenshotIntervalId) {
    // Update callbacks if changed, but do not spawn another interval
    screenshotCallback = onScreenshot;
    errorCallback = onError;
    return;
  }

  // Safely stop any existing timer before starting
  stopScreenshotCapture();

  activeScreenStream = screenStream;
  screenshotCallback = onScreenshot;
  errorCallback = onError;
  isSchedulerRunning = true;
  isCapturingInProgress = false;

  // 1. Capture one screenshot immediately
  captureTick();

  // 2. Schedule screenshot every 1000 milliseconds (Strict requirement: 1000ms)
  screenshotIntervalId = setInterval(captureTick, 1000);
}

/**
 * Stops the screenshot interval, prevents future captures, and clears active state.
 * Safe to call multiple times.
 */
export function stopScreenshotCapture() {
  if (screenshotIntervalId) {
    clearInterval(screenshotIntervalId);
    screenshotIntervalId = null;
  }

  isSchedulerRunning = false;
  isCapturingInProgress = false;
  activeScreenStream = null;
  screenshotCallback = null;
  errorCallback = null;
}

/**
 * Returns whether the screenshot scheduler is currently running.
 *
 * @returns {boolean}
 */
export function isScreenshotSchedulerActive() {
  return isSchedulerRunning;
}
