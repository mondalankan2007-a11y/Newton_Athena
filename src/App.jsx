import { useState, useRef, useEffect } from 'react';
import { createSession, endSession, getSession, getBackendHealth } from './services/api';
import { startScreenshotCapture, stopScreenshotCapture } from './services/screenshotScheduler';
import { formatFileSize } from './services/screenshotService';
import './App.css';

// ── Icons ───────────────────────────────────────────────────────────────────

function HeimdallLogo() {
  return (
    <div className="heimdall-brand">
      <svg className="heimdall-logo-icon" width="34" height="34" viewBox="0 0 36 36" fill="none">
        <defs>
          <linearGradient id="heimdallGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f97316" />
            <stop offset="1" stopColor="#dc2626" />
          </linearGradient>
        </defs>
        <rect width="36" height="36" rx="8" fill="url(#heimdallGrad)" />
        <path
          d="M8 12C8 9.5 11 7.5 13.5 9.5L15.5 12.5C16.3 11.5 17.1 11 18 11C18.9 11 19.7 11.5 20.5 12.5L22.5 9.5C25 7.5 28 9.5 28 12C28 17.5 25 24 18 27.5C11 24 8 17.5 8 12Z"
          fill="#18181b"
        />
        <path
          d="M13.5 16.5L16 19M22.5 16.5L20 19"
          stroke="#f97316"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M18 14.5V23M15 23H21"
          stroke="#f97316"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="heimdall-brand-text">HEIMDALL</span>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="M12 7v6M9 10l3-3 3 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#10b981" strokeWidth="1.5" />
      <path d="M5 8.2L7 10.2L11 6.2" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Progress Indicator (Requirement 10) ─────────────────────────────────────
function ProgressIndicator({ activeStep, cameraStatus, screenStatus }) {
  const isReady = cameraStatus === 'connected' && screenStatus === 'connected';

  return (
    <div className="progress-steps-bar">
      <div className={`progress-step ${activeStep === 1 ? 'is-active' : ''} ${cameraStatus === 'connected' ? 'is-complete' : ''}`}>
        <span className="step-num">{cameraStatus === 'connected' ? '✓' : '1'}</span>
        <span className="step-label">Step 1 — Camera</span>
      </div>
      <div className="progress-step-divider" />
      <div className={`progress-step ${activeStep === 2 ? 'is-active' : ''} ${screenStatus === 'connected' ? 'is-complete' : ''}`}>
        <span className="step-num">{screenStatus === 'connected' ? '✓' : '2'}</span>
        <span className="step-label">Step 2 — Screen</span>
      </div>
      <div className="progress-step-divider" />
      <div className={`progress-step ${activeStep === 3 ? 'is-active' : ''} ${isReady ? 'is-complete' : ''}`}>
        <span className="step-num">{isReady ? '✓' : '3'}</span>
        <span className="step-label">Step 3 — Ready</span>
      </div>
    </div>
  );
}

// ── Step Component: Camera Verification ─────────────────────────────────────
function CameraCheckModal({ currentStream, onCameraVerified, onBack }) {
  const [status, setStatus] = useState(currentStream ? 'connected' : 'requesting');
  const [errorMessage, setErrorMessage] = useState('');
  const [deviceName, setDeviceName] = useState('Using your Native MacBook camera.');
  const [retryKey, setRetryKey] = useState(0);

  const videoRef = useRef(null);
  const localStreamRef = useRef(currentStream || null);

  useEffect(() => {
    let isCancelled = false;

    async function initCamera() {
      // If we already have a stream passed in and didn't trigger retry, bind it
      if (localStreamRef.current && retryKey === 0) {
        if (videoRef.current) {
          videoRef.current.srcObject = localStreamRef.current;
        }
        return;
      }

      setStatus('requesting');
      setErrorMessage('');

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MediaDevicesUnsupported');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.label) {
          setDeviceName(`Using your ${videoTrack.label}.`);
        }

        setStatus('connected');

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (isCancelled) return;
        setStatus('error');
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage('Camera access was denied. Please allow camera permissions.');
        } else {
          setErrorMessage('Unable to access camera. Please verify device connection.');
        }
      }
    }

    initCamera();

    return () => {
      isCancelled = true;
    };
  }, [retryKey]);

  useEffect(() => {
    if (status === 'connected' && localStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = localStreamRef.current;
    }
  }, [status]);

  function handleConfirm() {
    if (localStreamRef.current) {
      onCameraVerified(localStreamRef.current, deviceName);
    }
  }

  return (
    <div className="heimdall-card">
      <div className="heimdall-header">
        <HeimdallLogo />
      </div>

      <div className="step-header">
        <div>
          <h2 className="step-title">Camera Check</h2>
          <p className="step-desc">Verify your webcam is properly connected and functioning.</p>
        </div>
      </div>

      <hr className="heimdall-divider" />

      <div className="device-row">
        <div className="device-info">
          <div className="device-icon-box">
            <CameraIcon />
          </div>
          <div className="device-text">
            <h3 className="device-title">Webcam Verification</h3>
            <p className="device-desc">Start your camera to proceed with the assessment.</p>

            {status === 'connected' && (
              <div className="permission-status">
                <div className="permission-badge">
                  <CheckIcon />
                  <span>Camera Connected</span>
                </div>
                <p className="device-subtext">{deviceName}</p>
              </div>
            )}

            {status === 'requesting' && (
              <div className="permission-status">
                <div className="permission-requesting">
                  <div className="mini-spinner" />
                  <span>Requesting camera access...</span>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="permission-status">
                <div className="permission-error">
                  <span>✖ {errorMessage}</span>
                </div>
                <button className="btn-retry" onClick={() => setRetryKey((k) => k + 1)}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="preview-container">
          {status === 'connected' ? (
            <video ref={videoRef} autoPlay muted playsInline className="live-video-feed" />
          ) : (
            <div className="preview-placeholder">
              <span>Camera preview unavailable</span>
            </div>
          )}
        </div>
      </div>

      <hr className="heimdall-divider" />

      <div className="btn-navigation-row">
        <button id="camera-back-btn" className="btn-action-ghost" onClick={onBack}>
          Back
        </button>
        <button
          id="confirm-camera-btn"
          className="btn-action-primary"
          disabled={status !== 'connected'}
          onClick={handleConfirm}
        >
          Confirm Camera
        </button>
      </div>
    </div>
  );
}

// ── Step Component: Screen Sharing Verification ─────────────────────────────
function ScreenSharingModal({ currentStream, onScreenVerified, onBack }) {
  const [status, setStatus] = useState(currentStream ? 'connected' : 'not-started');
  const [statusMessage, setStatusMessage] = useState('');
  const [needsSystemPermission, setNeedsSystemPermission] = useState(false);

  const screenVideoRef = useRef(null);
  const localStreamRef = useRef(currentStream || null);

  useEffect(() => {
    if (localStreamRef.current && screenVideoRef.current) {
      screenVideoRef.current.srcObject = localStreamRef.current;
    }
  }, []);

  // Check initial macOS screen recording permission
  useEffect(() => {
    async function checkPermission() {
      if (window.electronAPI?.getScreenAccessStatus) {
        try {
          const access = await window.electronAPI.getScreenAccessStatus();
          if (access === 'denied') {
            setNeedsSystemPermission(true);
            setStatusMessage('macOS Screen Recording permission is required. Please enable it in System Settings.');
          }
        } catch (e) {
          // ignore
        }
      }
    }
    checkPermission();
  }, []);

  async function handleShareScreen() {
    setStatus('waiting');
    setStatusMessage('');
    setNeedsSystemPermission(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('DisplayMediaUnsupported');
      }

      // Check macOS permission before requesting
      if (window.electronAPI?.getScreenAccessStatus) {
        const access = await window.electronAPI.getScreenAccessStatus();
        if (access === 'denied') {
          setStatus('error');
          setNeedsSystemPermission(true);
          setStatusMessage('Screen Recording permission is disabled in macOS System Settings.');
          return;
        }
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      localStreamRef.current = stream;
      setStatus('connected');
      setStatusMessage('Screen sharing connected');
      setNeedsSystemPermission(false);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      // Check if it failed due to macOS system permission
      let isSystemDenied = false;
      if (window.electronAPI?.getScreenAccessStatus) {
        try {
          const access = await window.electronAPI.getScreenAccessStatus();
          if (access === 'denied' || access === 'restricted') {
            isSystemDenied = true;
          }
        } catch (e) {}
      }

      if (isSystemDenied) {
        setStatus('error');
        setNeedsSystemPermission(true);
        setStatusMessage('macOS Screen Recording permission required. Please enable it in System Settings.');
      } else if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        setStatus('not-started');
        setStatusMessage('Screen sharing was not selected or permission was denied.');
      } else {
        setStatus('error');
        setStatusMessage('Screen sharing permission was denied or unavailable.');
      }
    }
  }

  function handleOpenSettings() {
    if (window.electronAPI?.openScreenSecuritySettings) {
      window.electronAPI.openScreenSecuritySettings();
    }
  }

  function handleConfirm() {
    if (localStreamRef.current) {
      onScreenVerified(localStreamRef.current);
    }
  }

  return (
    <div className="heimdall-card">
      <div className="heimdall-header">
        <HeimdallLogo />
      </div>

      <div className="step-header">
        <div>
          <h2 className="step-title">Screen Sharing Check</h2>
          <p className="step-desc">
            Select the screen or window you want to share for the assessment.
          </p>
        </div>
      </div>

      <hr className="heimdall-divider" />

      <div className="device-row">
        <div className="device-info">
          <div className="device-icon-box">
            <ScreenIcon />
          </div>
          <div className="device-text">
            <h3 className="device-title">Screen Capture</h3>
            <p className="device-desc">You must explicitly select a screen or window.</p>

            {status === 'connected' && (
              <div className="permission-status">
                <div className="permission-badge">
                  <CheckIcon />
                  <span>Screen Sharing Connected</span>
                </div>
              </div>
            )}

            {status === 'waiting' && (
              <div className="permission-status">
                <div className="permission-requesting">
                  <div className="mini-spinner" />
                  <span>Waiting for permission...</span>
                </div>
              </div>
            )}

            {statusMessage && status !== 'connected' && status !== 'waiting' && (
              <div className="permission-status">
                <div className="permission-notice-box">
                  <span>{statusMessage}</span>
                  {needsSystemPermission && (
                    <button
                      type="button"
                      id="open-settings-btn"
                      className="btn-open-settings"
                      onClick={handleOpenSettings}
                    >
                      Open macOS System Settings
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="share-btn-wrap">
              <button
                id="share-screen-btn"
                className="btn-share-screen"
                onClick={handleShareScreen}
                disabled={status === 'waiting'}
              >
                {status === 'connected' ? 'Change Screen' : 'Share Screen'}
              </button>
            </div>
          </div>
        </div>

        <div className="preview-container preview-container--large">
          {status === 'connected' && localStreamRef.current ? (
            <video ref={screenVideoRef} autoPlay muted playsInline className="screen-video-feed" />
          ) : (
            <div className="preview-placeholder">
              <span>Screen preview unavailable</span>
            </div>
          )}
        </div>
      </div>

      <hr className="heimdall-divider" />

      <div className="btn-navigation-row">
        <button id="screen-back-btn" className="btn-action-ghost" onClick={onBack}>
          Back
        </button>
        <button
          id="confirm-screen-btn"
          className="btn-action-primary"
          disabled={status !== 'connected'}
          onClick={handleConfirm}
        >
          Confirm Screen
        </button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a short, human-readable session ID like "NA-X4F2A8" */
function generateSessionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'NA-';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/** Formats elapsed seconds into mm:ss string */
function formatElapsed(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Formats Date into 24-hour HH:MM:SS string, e.g. "22:15:32" */
function formatCheckTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${h}:${m}:${s}`;
}

// ── Root Application ────────────────────────────────────────────────────────
export default function App() {
  // Navigation flow: 'initial' | 'pre-test' | 'camera-check' | 'screen-check' | 'in-progress'
  const [flow, setFlow] = useState('initial');

  // Device check status states:
  // 'not-checked' | 'connected' | 'error' | 'disconnected'
  const [cameraStatus, setCameraStatus] = useState('not-checked');
  const [screenStatus, setScreenStatus] = useState('not-checked');
  const [cameraDeviceName, setCameraDeviceName] = useState('');

  // ── Session state (Commit 7 & 10) ──────────────────────────────────────────
  // session: null | { sessionId, status, startedAt, endedAt }
  const [session, setSession] = useState(null);
  // elapsed seconds for the in-progress timer
  const [elapsed, setElapsed] = useState(0);
  // Ref to hold the interval ID so it can be cleared safely
  const timerRef = useRef(null);

  // Backend session synchronization states (Commit 10)
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [backendError, setBackendError] = useState('');
  const [pendingSessionId, setPendingSessionId] = useState('');

  // Backend connection & periodic session check states (Commit 11)
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'
  const [lastServerCheck, setLastServerCheck] = useState('');
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);

  const sessionCheckIntervalRef = useRef(null);
  const isCheckingBackendRef = useRef(false);
  const endLocalAssessmentRef = useRef(null);

  // Active MediaStreams
  const [cameraStream, setCameraStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);

  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // ── Screenshot Monitoring & Statistics States (Commit 13 & 14) ───────────
  const [screenshotCount, setScreenshotCount] = useState(0); // totalScreenshots
  const [lastScreenshotTime, setLastScreenshotTime] = useState('');
  const [latestScreenshotUrl, setLatestScreenshotUrl] = useState(null);
  const [latestScreenshotSize, setLatestScreenshotSize] = useState(0); // size in bytes
  const [totalBytesCaptured, setTotalBytesCaptured] = useState(0); // running total bytes
  const [screenshotStatus, setScreenshotStatus] = useState('Inactive'); // 'Inactive' | 'Active' | 'Screenshot capture failed'

  const latestScreenshotUrlRef = useRef(null);

  /** Safely revokes and resets the latest screenshot object URL */
  function clearScreenshotPreview() {
    if (latestScreenshotUrlRef.current) {
      URL.revokeObjectURL(latestScreenshotUrlRef.current);
      latestScreenshotUrlRef.current = null;
    }
    setLatestScreenshotUrl(null);
  }

  // Sync refs with states
  useEffect(() => {
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  // Cleanup helper for all streams
  function cleanupAllStreams() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    stopScreenshotCapture();
    clearScreenshotPreview();
    setScreenshotStatus('Inactive');
    setLatestScreenshotSize(0);
    setTotalBytesCaptured(0);
    setCameraStream(null);
    setScreenStream(null);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllStreams();
      stopTimer();
      stopSessionCheck();
      stopScreenshotCapture();
      clearScreenshotPreview();
    };
  }, []);

  // Set up unexpected disconnect listeners (Requirements 12 & 13)
  function attachCameraDisconnectListener(stream) {
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.onended = () => {
        setCameraStatus('disconnected');
        setCameraStream(null);
        cameraStreamRef.current = null;
      };
    }
  }

  function attachScreenDisconnectListener(stream) {
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.onended = () => {
        stopScreenshotCapture();
        clearScreenshotPreview();
        setScreenshotStatus('Inactive');
        setScreenStatus('disconnected');
        setScreenStream(null);
        screenStreamRef.current = null;
      };
    }
  }

  // Handlers for verifying camera
  function handleCameraVerified(stream, deviceName) {
    setCameraStream(stream);
    cameraStreamRef.current = stream;
    setCameraStatus('connected');
    setCameraDeviceName(deviceName);
    attachCameraDisconnectListener(stream);
    setFlow('pre-test');
  }

  // Handlers for verifying screen sharing
  function handleScreenVerified(stream) {
    setScreenStream(stream);
    screenStreamRef.current = stream;
    setScreenStatus('connected');
    attachScreenDisconnectListener(stream);
    setFlow('pre-test');
  }

  // ── Session management (Commit 7 & 10) ─────────────────────────────────────

  /** Start a new assessment session with the backend. Guards against double-start. */
  async function startSession() {
    if (session && session.status === 'active') return; // already running
    if (isStartingSession) return; // already in flight

    // Reuse pending sessionId on retry or generate a new one
    const sessionIdToUse = pendingSessionId || generateSessionId();
    setPendingSessionId(sessionIdToUse);
    setIsStartingSession(true);
    setBackendError('');

    try {
      // Connect to Express backend: POST /api/sessions
      const response = await createSession(sessionIdToUse);

      const backendSession = response?.session || {
        sessionId: sessionIdToUse,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null,
      };

      setSession(backendSession);
      setPendingSessionId('');
      setElapsed(0);
      setScreenshotCount(0);
      setLastScreenshotTime('');
      setLatestScreenshotSize(0);
      setTotalBytesCaptured(0);
      setScreenshotStatus('Active');
      clearScreenshotPreview();
      setFlow('in-progress');

      // Start timer — one interval only
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start assessment session on backend:', err);
      setBackendError(err.message || 'Unable to connect to the assessment server.');
    } finally {
      setIsStartingSession(false);
    }
  }

  /** Stop timer and clean up the interval safely. */
  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  /** Stop session check interval safely. */
  function stopSessionCheck() {
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }
  }

  /** Safely ends the local assessment (Requirement 11) */
  function endLocalAssessment(endedAt) {
    stopTimer();
    stopSessionCheck();
    cleanupAllStreams();
    setSession((prev) =>
      prev ? { ...prev, status: 'completed', endedAt: endedAt || new Date().toISOString() } : null
    );
    setCameraStatus('not-checked');
    setScreenStatus('not-checked');
    setBackendError('');
    setPendingSessionId('');
    setFlow('initial');
    setTimeout(() => setSession(null), 50);
  }

  endLocalAssessmentRef.current = endLocalAssessment;

  /** Re-checks backend health and current session status upon manual retry (Requirement 8) */
  async function handleRetryConnection() {
    if (isCheckingBackendRef.current) return;
    isCheckingBackendRef.current = true;
    setIsCheckingBackend(true);
    setBackendStatus('checking');

    try {
      // 1. Run backend health check (Requirement 1 & 8)
      await getBackendHealth();

      // 2. Query active session (Requirement 9 & 10)
      if (session?.sessionId) {
        const data = await getSession(session.sessionId);
        if (data?.session?.status === 'completed') {
          if (endLocalAssessmentRef.current) {
            endLocalAssessmentRef.current(data.session?.endedAt);
          }
          return;
        }
      }

      setBackendStatus('connected');
      setLastServerCheck(formatCheckTime(new Date()));
    } catch (err) {
      console.warn('Backend retry connection failed:', err.message);
      setBackendStatus('disconnected');
    } finally {
      isCheckingBackendRef.current = false;
      setIsCheckingBackend(false);
    }
  }

  /** End the assessment: notify backend, stop timer, stop streams, go home. */
  async function handleEndTest() {
    if (isEndingSession) return;
    setIsEndingSession(true);

    // Stop session check interval immediately (Requirement 13)
    stopSessionCheck();

    // Notify backend: PATCH /api/sessions/:sessionId/end
    if (session?.sessionId) {
      try {
        await endSession(session.sessionId);
      } catch (err) {
        console.warn('Could not complete session on backend:', err.message);
      }
    }

    // Always cleanly reset local state (Requirement 11)
    stopTimer();
    setSession((prev) =>
      prev ? { ...prev, status: 'completed', endedAt: new Date().toISOString() } : prev
    );
    cleanupAllStreams();
    setCameraStatus('not-checked');
    setScreenStatus('not-checked');
    setBackendError('');
    setPendingSessionId('');
    setIsEndingSession(false);
    setFlow('initial');

    // Clear session after a tick so the UI doesn't flash
    setTimeout(() => setSession(null), 50);
  }

  // Clean up timer and intervals on unmount (prevents memory leaks / stale intervals)
  useEffect(() => {
    return () => {
      stopTimer();
      stopSessionCheck();
    };
  }, []);

  // ── Periodic 10-second Session Check & Initial Connection Check (Commit 11) ──
  useEffect(() => {
    // Only run when in active assessment with a valid sessionId
    if (flow !== 'in-progress' || !session?.sessionId) {
      stopSessionCheck();
      return;
    }

    const currentSessionId = session.sessionId;

    // 1. Connection check when the assessment screen opens (Requirements 4, 5, 6, 7)
    // Non-blocking UI
    setBackendStatus('checking');

    async function runInitialCheck() {
      if (isCheckingBackendRef.current) return;
      isCheckingBackendRef.current = true;
      setIsCheckingBackend(true);

      try {
        await getBackendHealth();
        const data = await getSession(currentSessionId);
        setBackendStatus('connected');
        setLastServerCheck(formatCheckTime(new Date()));

        if (data?.session?.status === 'completed') {
          if (endLocalAssessmentRef.current) {
            endLocalAssessmentRef.current(data.session?.endedAt);
          }
        }
      } catch (err) {
        console.warn('Initial backend connection check failed:', err.message);
        setBackendStatus('disconnected');
      } finally {
        isCheckingBackendRef.current = false;
        setIsCheckingBackend(false);
      }
    }

    runInitialCheck();

    // 2. Periodic 10-second session check (Requirements 9-13)
    stopSessionCheck();

    const intervalId = setInterval(async () => {
      if (isCheckingBackendRef.current) return;
      isCheckingBackendRef.current = true;

      try {
        const data = await getSession(currentSessionId);
        setBackendStatus('connected');
        setLastServerCheck(formatCheckTime(new Date()));

        if (data?.session?.status === 'completed') {
          if (endLocalAssessmentRef.current) {
            endLocalAssessmentRef.current(data.session?.endedAt);
          }
        }
      } catch (err) {
        console.warn('Periodic session check failed:', err.message);
        // Requirement 12: Do not immediately end assessment. Show Backend: Disconnected.
        setBackendStatus('disconnected');
      } finally {
        isCheckingBackendRef.current = false;
      }
    }, 10000);

    sessionCheckIntervalRef.current = intervalId;

    return () => {
      stopSessionCheck();
    };
  }, [flow, session?.sessionId]);

  // ── Automatic 1-Second Screenshot Capture Loop (Commit 13 & 14) ───────────
  useEffect(() => {
    const isAssessmentActive = flow === 'in-progress' && session?.status === 'active';
    const isScreenLive = screenStream && screenStream.getVideoTracks().some((t) => t.readyState === 'live');

    if (isAssessmentActive && isScreenLive) {
      setScreenshotStatus('Active');

      startScreenshotCapture(
        screenStream,
        (blob) => {
          setScreenshotCount((prev) => prev + 1);
          setLastScreenshotTime(new Date().toLocaleTimeString());
          if (blob && typeof blob.size === 'number') {
            setLatestScreenshotSize(blob.size);
            setTotalBytesCaptured((prev) => prev + blob.size);
          }
          setScreenshotStatus('Active');

          const newUrl = URL.createObjectURL(blob);
          // Revoke the previous object URL before replacing it
          if (latestScreenshotUrlRef.current) {
            URL.revokeObjectURL(latestScreenshotUrlRef.current);
          }
          latestScreenshotUrlRef.current = newUrl;
          setLatestScreenshotUrl(newUrl);
        },
        (err) => {
          console.warn('Screenshot capture failed:', err?.message);
          setScreenshotStatus('Screenshot capture failed');
        }
      );
    } else {
      stopScreenshotCapture();
      if (!isAssessmentActive) {
        clearScreenshotPreview();
        setScreenshotStatus('Inactive');
        setLatestScreenshotSize(0);
        setTotalBytesCaptured(0);
      } else if (!isScreenLive) {
        setScreenshotStatus('Inactive');
      }
    }

    return () => {
      stopScreenshotCapture();
    };
  }, [flow, session?.status, screenStream]);

  // Determine current active progress step (Requirement 10)
  function getActiveStep() {
    if (flow === 'camera-check') return 1;
    if (flow === 'screen-check') return 2;
    if (cameraStatus === 'connected' && screenStatus === 'connected') return 3;
    if (cameraStatus === 'connected') return 2;
    return 1;
  }

  const isBothConnected = cameraStatus === 'connected' && screenStatus === 'connected';

  return (
    <div className="heimdall-app">
      {/* ── View 1: Initial Screen (Commit 1 & 2 integration) ── */}
      {flow === 'initial' && (
        <div className="heimdall-card">
          <div className="heimdall-header">
            <HeimdallLogo />
          </div>
          <div className="initial-hero">
            <h1 className="initial-title">Newton Athena</h1>
            <p className="initial-subtitle">Assessment Monitoring System</p>
            <div className="initial-details-box">
              <div className="detail-item">
                <span className="detail-label">Assessment</span>
                <span className="detail-value">Electron Application Development</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Duration</span>
                <span className="detail-value">60 Minutes</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Required</span>
                <span className="detail-value">Camera & Screen Sharing</span>
              </div>
            </div>
            <button
              id="start-test-btn"
              className="btn-action-primary btn--large"
              onClick={() => setFlow('pre-test')}
            >
              Start Test
            </button>
          </div>
        </div>
      )}

      {/* ── View 2: Pre-Test Device Check Screen (Commit 6 Goal) ── */}
      {flow === 'pre-test' && (
        <div className="heimdall-card">
          <div className="heimdall-header">
            <HeimdallLogo />
          </div>

          {/* Progress Indicator (Requirement 10) */}
          <ProgressIndicator
            activeStep={getActiveStep()}
            cameraStatus={cameraStatus}
            screenStatus={screenStatus}
          />

          {/* Title & Description (Requirement 1) */}
          <div className="step-header" style={{ marginTop: '20px' }}>
            <div>
              <h2 className="step-title">Pre-Test Device Check</h2>
              <p className="step-desc">
                Before starting the assessment, please verify your camera and screen sharing.
              </p>
            </div>
          </div>

          <hr className="heimdall-divider" />

          {/* Two Status Cards (Requirement 2 & 3 & 9) */}
          <div className="device-cards-grid">
            {/* Card 1: Camera */}
            <div className={`device-status-card status--${cameraStatus}`}>
              <div className="device-card-header">
                <div className="device-card-icon-title">
                  <div className="mini-icon-circle"><CameraIcon /></div>
                  <h4>Camera</h4>
                </div>
                <span className="device-card-badge">
                  {cameraStatus === 'connected' && '✓ Camera Connected'}
                  {cameraStatus === 'error' && '✕ Camera Error'}
                  {cameraStatus === 'disconnected' && '✕ Camera Disconnected'}
                  {cameraStatus === 'not-checked' && '○ Camera Not Checked'}
                </span>
              </div>
              <p className="device-card-detail">
                {cameraStatus === 'connected' && (cameraDeviceName || 'Webcam verified and active')}
                {cameraStatus === 'error' && 'Camera permission was denied or device unavailable.'}
                {cameraStatus === 'disconnected' && 'Camera stream stopped. Please recheck.'}
                {cameraStatus === 'not-checked' && 'Webcam access required to monitor assessment.'}
              </p>
              <button
                id="check-camera-btn"
                className="btn-card-action"
                onClick={() => setFlow('camera-check')}
              >
                {cameraStatus === 'connected' ? 'Recheck Camera' : 'Check Camera'}
              </button>
            </div>

            {/* Card 2: Screen Sharing */}
            <div className={`device-status-card status--${screenStatus}`}>
              <div className="device-card-header">
                <div className="device-card-icon-title">
                  <div className="mini-icon-circle"><ScreenIcon /></div>
                  <h4>Screen Sharing</h4>
                </div>
                <span className="device-card-badge">
                  {screenStatus === 'connected' && '✓ Screen Sharing Connected'}
                  {screenStatus === 'error' && '✕ Screen Error'}
                  {screenStatus === 'disconnected' && '✕ Screen Sharing Disconnected'}
                  {screenStatus === 'not-checked' && '○ Screen Sharing Not Checked'}
                </span>
              </div>
              <p className="device-card-detail">
                {screenStatus === 'connected' && 'Screen capture stream verified and active'}
                {screenStatus === 'error' && 'Screen sharing was cancelled or unavailable.'}
                {screenStatus === 'disconnected' && 'Screen share ended. Please recheck.'}
                {screenStatus === 'not-checked' && 'Entire screen sharing required before test.'}
              </p>
              <button
                id="check-screen-btn"
                className="btn-card-action"
                onClick={() => setFlow('screen-check')}
              >
                {screenStatus === 'connected' ? 'Recheck Screen' : 'Check Screen Sharing'}
              </button>
            </div>
          </div>

          <hr className="heimdall-divider" />

          {/* Readiness Notice (Requirement 7 & 8) */}
          {isBothConnected ? (
            <div className="notice notice--ok">
              Your device is ready for the assessment.
            </div>
          ) : (
            <div className="notice notice--warn">
              {cameraStatus !== 'connected' && screenStatus !== 'connected'
                ? 'Please complete both Camera and Screen Sharing checks before starting.'
                : cameraStatus !== 'connected'
                ? 'Camera check is incomplete. Please verify your camera.'
                : 'Screen Sharing check is incomplete. Please verify screen sharing.'}
            </div>
          )}

          {/* Backend Error Box with Retry (Requirement 6 & 7) */}
          {backendError && (
            <div className="backend-error-box">
              <div className="backend-error-msg">
                <span>⚠️ {backendError}</span>
              </div>
              <button
                id="retry-start-btn"
                className="btn-retry-action"
                onClick={startSession}
                disabled={isStartingSession}
              >
                {isStartingSession ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          )}

          {/* Action Row (Requirement 7, 8, 14) */}
          <div className="btn-navigation-row" style={{ marginTop: '16px' }}>
            <button
              id="back-to-start-btn"
              className="btn-action-ghost"
              onClick={() => {
                cleanupAllStreams();
                setBackendError('');
                setPendingSessionId('');
                setFlow('initial');
              }}
            >
              Back
            </button>
            <button
              id="start-assessment-btn"
              className="btn-action-primary"
              disabled={!isBothConnected || isStartingSession}
              onClick={startSession}
            >
              {isStartingSession ? 'Starting assessment...' : 'Start Assessment'}
            </button>
          </div>
        </div>
      )}

      {/* ── View 3: Dedicated Camera Check Step ── */}
      {flow === 'camera-check' && (
        <CameraCheckModal
          currentStream={cameraStream}
          onCameraVerified={handleCameraVerified}
          onBack={() => setFlow('pre-test')}
        />
      )}

      {/* ── View 4: Dedicated Screen Sharing Step ── */}
      {flow === 'screen-check' && (
        <ScreenSharingModal
          currentStream={screenStream}
          onScreenVerified={handleScreenVerified}
          onBack={() => setFlow('pre-test')}
        />
      )}

      {/* ── View 5: Assessment In Progress Screen (Commit 7) ── */}
      {flow === 'in-progress' && session && (
        <div className="heimdall-card">
          <div className="heimdall-header">
            <HeimdallLogo />
          </div>

          {/* Status header row */}
          <div className="session-status-header">
            <div className="session-status-left">
              <h2 className="step-title">Assessment In Progress</h2>
              <p className="step-desc">Your session is being monitored. Do not close this window.</p>
            </div>
            <div className="session-live-badge">
              <span className="pulse-live-dot" />
              <span>LIVE</span>
            </div>
          </div>

          <hr className="heimdall-divider" />

          {/* Session info grid */}
          <div className="session-info-grid">
            <div className="session-info-item">
              <span className="session-info-label">Session ID</span>
              <span className="session-info-value session-id-mono">{session.sessionId}</span>
            </div>
            <div className="session-info-item">
              <span className="session-info-label">Status</span>
              <span className="session-info-value status-active-text">● Active</span>
            </div>
            <div className="session-info-item">
              <span className="session-info-label">Time Elapsed</span>
              <span className="session-info-value session-timer-display">{formatElapsed(elapsed)}</span>
            </div>
            <div className="session-info-item">
              <span className="session-info-label">Started At</span>
              <span className="session-info-value">
                {new Date(session.startedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <hr className="heimdall-divider" />

          {/* Device and Backend monitoring status (Commit 11) */}
          <div className="session-devices-row">
            <div
              id="backend-status-pill"
              className={`session-device-pill pill--${backendStatus}`}
            >
              <span
                className={`device-pill-dot dot-${
                  backendStatus === 'connected'
                    ? 'green'
                    : backendStatus === 'checking'
                    ? 'amber'
                    : 'red'
                }`}
              />
              <span>
                Backend: {backendStatus === 'connected' && 'Connected'}
                {backendStatus === 'checking' && 'Checking...'}
                {backendStatus === 'disconnected' && 'Disconnected'}
              </span>
            </div>
            <div className="session-device-pill">
              <span className="device-pill-dot dot-green" />
              <span>Camera: Connected</span>
            </div>
            <div className="session-device-pill">
              <span className="device-pill-dot dot-green" />
              <span>Screen: Connected</span>
            </div>
          </div>

          {/* Last server check timestamp (Requirement 14 & 15) */}
          <div className="session-last-check-row">
            <span id="last-server-check" className="last-check-text">
              Last server check: {lastServerCheck || '--:--:--'}
            </span>
          </div>

          {/* Backend Unavailable Warning Box & Retry (Requirements 8 & 16) */}
          {backendStatus === 'disconnected' && (
            <div className="session-server-warning-box" id="backend-lost-warning">
              <div className="warning-content">
                <span className="warning-icon">⚠️</span>
                <span className="warning-message">
                  Connection to the assessment server was lost. Retrying...
                </span>
              </div>
              <button
                id="retry-connection-btn"
                className="btn-retry-action"
                onClick={handleRetryConnection}
                disabled={isCheckingBackend}
              >
                {isCheckingBackend ? 'Checking...' : 'Retry Connection'}
              </button>
            </div>
          )}

          <hr className="heimdall-divider" />

          {/* ── Screenshot Monitoring Section (Commit 13) ── */}
          <div className="screenshot-monitor-section" id="screenshot-monitoring-section">
            <div className="screenshot-monitor-header">
              <div className="screenshot-monitor-title-group">
                <span className="screenshot-monitor-badge">SCREEN CAPTURE</span>
                <h3 className="screenshot-monitor-heading">Screenshot Monitoring</h3>
              </div>
              <div
                id="screenshot-status-pill"
                className={`session-device-pill ${
                  screenshotStatus === 'Active'
                    ? ''
                    : screenshotStatus === 'Screenshot capture failed'
                    ? 'pill--disconnected'
                    : 'pill--checking'
                }`}
              >
                <span
                  className={`device-pill-dot ${
                    screenshotStatus === 'Active'
                      ? 'dot-green'
                      : screenshotStatus === 'Screenshot capture failed'
                      ? 'dot-red'
                      : 'dot-amber'
                  }`}
                />
                <span id="screenshot-status-text">Status: {screenshotStatus}</span>
              </div>
            </div>

            <div className="screenshot-monitor-body">
              {/* Monitoring metrics */}
              <div className="screenshot-metrics-grid">
                <div className="screenshot-metric-box">
                  <span className="metric-box-label">Capture Rate</span>
                  <span className="metric-box-value" id="screenshot-capture-rate">
                    1 screenshot / second
                  </span>
                </div>
                <div className="screenshot-metric-box">
                  <span className="metric-box-label">Screenshots Captured</span>
                  <span className="metric-box-value count-value" id="screenshot-count-display">
                    {screenshotCount}
                  </span>
                </div>
                <div className="screenshot-metric-box">
                  <span className="metric-box-label">Last Screenshot</span>
                  <span className="metric-box-value time-value" id="screenshot-last-time">
                    {lastScreenshotTime || '--:--:--'}
                  </span>
                </div>
                <div className="screenshot-metric-box">
                  <span className="metric-box-label">Latest Screenshot Size</span>
                  <span className="metric-box-value size-value" id="screenshot-latest-size">
                    {latestScreenshotSize ? formatFileSize(latestScreenshotSize) : '--'}
                  </span>
                </div>
                <div className="screenshot-metric-box">
                  <span className="metric-box-label">Data Captured</span>
                  <span className="metric-box-value data-value" id="screenshot-total-data">
                    {formatFileSize(totalBytesCaptured)}
                  </span>
                </div>
              </div>

              {/* Latest Screenshot Preview */}
              <div className="screenshot-preview-container">
                <div className="screenshot-preview-topbar">
                  <span className="preview-topbar-label">Latest Capture Preview</span>
                  <span className="preview-topbar-tag">1 FPS</span>
                </div>
                <div className="screenshot-preview-display">
                  {latestScreenshotUrl ? (
                    <img
                      id="screenshot-preview-img"
                      src={latestScreenshotUrl}
                      alt="Latest Screen Capture Preview"
                      className="screenshot-preview-image"
                    />
                  ) : (
                    <div className="screenshot-preview-placeholder">
                      <div className="mini-spinner" />
                      <span>Capturing first frame...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <hr className="heimdall-divider" />

          <div className="btn-navigation-row" style={{ justifyContent: 'center' }}>
            <button
              id="end-test-btn"
              className="btn-action-danger"
              disabled={isEndingSession}
              onClick={handleEndTest}
            >
              {isEndingSession ? 'Ending assessment...' : 'End Test'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom status text */}
      <div className="active-banner-container">
        <p className="active-running-text">
          Heimdall is currently active and running. Go to Newton Athena to continue the test.
        </p>
      </div>
    </div>
  );
}
