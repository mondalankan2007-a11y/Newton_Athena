/**
 * API client utility for communicating with the Newton Athena backend server.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
    case 500:
      return 'The assessment server encountered an internal error. Please try again.';
    default:
      return `Server responded with error status ${status}.`;
  }
}

export { API_BASE_URL };
