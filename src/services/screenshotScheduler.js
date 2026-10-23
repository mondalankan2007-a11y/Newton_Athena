/**
 * Screenshot Scheduler Service
 *
 * Manages an automatic screenshot loop that captures a frame from the user's
 * screen-sharing stream every 1000 milliseconds (1 FPS).
 *
 * Features:
 * - Immediate initial capture on start.
 * - Exact 1000ms recurring interval.
 * - Prevents overlapping captures (if capture takes longer than 1000ms, skips concurrent run).
 * - Safe multiple-call stop function.
 * - Stops immediately if screen stream ends.
 * - Completely independent from the 10-second backend session polling interval.
 */

import { captureScreenshot } from './screenshotService.js';

let screenshotIntervalId = null;
let isCapturingInProgress = false;
let isSchedulerRunning = false;
let activeScreenStream = null;
let screenshotCallback = null;
let errorCallback = null;

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
    // Previous capture is still in flight; wait for it and skip this cycle
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

    // Only deliver callback if scheduler is still running
    if (isSchedulerRunning && typeof screenshotCallback === 'function') {
      screenshotCallback(blob);
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
 *
 * @param {MediaStream} screenStream - Explicitly selected screen-sharing MediaStream
 * @param {Function} onScreenshot - Callback receiving each captured JPEG Blob: (blob) => void
 * @param {Function} [onError] - Optional callback receiving any capture errors: (error) => void
 */
export function startScreenshotCapture(screenStream, onScreenshot, onError) {
  // Clear any existing scheduler state first
  stopScreenshotCapture();

  if (!isStreamTrackLive(screenStream)) {
    if (typeof onError === 'function') {
      onError(new Error('Cannot start capture: screen stream is missing or has ended.'));
    }
    return;
  }

  activeScreenStream = screenStream;
  screenshotCallback = onScreenshot;
  errorCallback = onError;
  isSchedulerRunning = true;
  isCapturingInProgress = false;

  // 1. Capture one screenshot immediately
  captureTick();

  // 2. Schedule screenshot every 1000 milliseconds
  screenshotIntervalId = setInterval(captureTick, 1000);
}

/**
 * Stops the screenshot interval, prevents future captures, and clears pending state.
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
