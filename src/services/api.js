/**
 * API client utility for communicating with the Newton Athena backend server.
 */

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3001';

/**
 * Checks the health status of the backend server.
 * @returns {Promise<{ status: string, service?: string }>}
 */
export async function getBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.error || getHttpErrorMessage(response.status);
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status) {
      throw err;
    }
    const networkError = new Error('Unable to connect to the assessment server.');
    networkError.isNetworkError = true;
    throw networkError;
  }
}

/**
 * Creates a new assessment session on the backend.
 * @param {string} sessionId
 * @returns {Promise<{ success: boolean, session: object }>}
 */
export async function createSession(sessionId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.error || getHttpErrorMessage(response.status);
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status) {
      throw err;
    }
    // Network / server unavailable errors
    const networkError = new Error('Unable to connect to the assessment server.');
    networkError.isNetworkError = true;
    throw networkError;
  }
}

/**
 * Marks an existing assessment session as completed on the backend.
 * @param {string} sessionId
 * @returns {Promise<{ success: boolean, session: object }>}
 */
export async function endSession(sessionId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}/end`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.error || getHttpErrorMessage(response.status);
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status) {
      throw err;
    }
    const networkError = new Error('Unable to connect to the assessment server.');
    networkError.isNetworkError = true;
    throw networkError;
  }
}

/**
 * Retrieves an existing assessment session by ID.
 * @param {string} sessionId
 * @returns {Promise<{ success: boolean, session: object }>}
 */
export async function getSession(sessionId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}`
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.error || getHttpErrorMessage(response.status);
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status) {
      throw err;
    }
    const networkError = new Error('Unable to connect to the assessment server.');
    networkError.isNetworkError = true;
    throw networkError;
  }
}

/**
 * Uploads a JPEG screenshot Blob along with metadata to the backend for an active session.
 * @param {string} sessionId
 * @param {Blob} screenshotBlob
 * @param {object} [metadata]
 * @returns {Promise<{ success: boolean, screenshot: object }>}
 */
export async function uploadScreenshot(sessionId, screenshotBlob, metadata = {}) {
  if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('A valid sessionId is required to upload a screenshot.');
  }

  if (!screenshotBlob || !(screenshotBlob instanceof Blob)) {
    throw new Error('A valid screenshot Blob is required for upload.');
  }

  const formData = new FormData();
  formData.append('screenshot', screenshotBlob, 'screenshot.jpg');

  // Metadata fields (Commit 19)
  formData.append('sessionId', metadata.sessionId || sessionId.trim());
  if (metadata.sequence !== undefined && metadata.sequence !== null) {
    formData.append('sequence', String(metadata.sequence));
  }
  if (metadata.capturedAt) {
    formData.append('capturedAt', String(metadata.capturedAt));
  }
  if (metadata.size !== undefined && metadata.size !== null) {
    formData.append('size', String(metadata.size));
  }
  if (metadata.mimeType) {
    formData.append('mimeType', String(metadata.mimeType));
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId.trim())}/screenshots`,
      {
        method: 'POST',
        body: formData,
        // Browser / fetch automatically sets Content-Type with multipart boundary
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = data?.error || getHttpErrorMessage(response.status);
      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status) {
      throw err;
    }
    const networkError = new Error('Unable to connect to the assessment server.');
    networkError.isNetworkError = true;
    throw networkError;
  }
}

/**
 * Returns a user-friendly error message for standard HTTP statuses.
 * @param {number} status
 * @returns {string}
 */
function getHttpErrorMessage(status) {
  switch (status) {
    case 400:
      return 'Invalid session request. Please check session details.';
    case 404:
      return 'Session was not found on the assessment server.';
    case 409:
      return 'A session with this ID is already active.';
    case 413:
      return 'Screenshot file size exceeds the 2 MB limit.';
    case 500:
      return 'The assessment server encountered an internal error. Please try again.';
    default:
      return `Server responded with error status ${status}.`;
  }
}

export { API_BASE_URL };

