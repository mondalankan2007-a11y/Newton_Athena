import { useState, useRef, useEffect, useCallback } from 'react';
import { createSession, endSession, getSession, getBackendHealth } from './services/api';
import { startScreenshotCapture, stopScreenshotCapture, resetScreenshotSequence } from './services/screenshotScheduler';
import { formatFileSize, uploadScreenshotWithRetry, MAX_SCREENSHOT_RETRIES } from './services/screenshotService';
import './App.css';

// ── Assessment Questions ────────────────────────────────────────────────────

const QUESTIONS = [
  {
    id: 1,
    text: 'What is the time complexity of binary search on a sorted array?',
    options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
    correct: 1,
  },
  {
    id: 2,
    text: 'Which data structure follows LIFO?',
    options: ['Queue', 'Stack', 'Linked List', 'Tree'],
    correct: 1,
  },
  {
    id: 3,
    text: 'Which traversal visits Root → Left → Right?',
    options: ['Inorder', 'Postorder', 'Preorder', 'Level Order'],
    correct: 2,
  },
  {
    id: 4,
    text: 'What is the average time complexity of accessing an array element by index?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
    correct: 0,
  },
  {
    id: 5,
    text: 'Which sorting algorithm has average O(n log n) time complexity?',
    options: ['Bubble Sort', 'Selection Sort', 'Merge Sort', 'Linear Search'],
    correct: 2,
  },
];

// ── Icons ───────────────────────────────────────────────────────────────────

function NaLogo() {
  return (
    <div className="na-brand">
      <svg className="na-logo-icon" width="34" height="34" viewBox="0 0 36 36" fill="none">
        <defs>
          <linearGradient id="naGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366f1" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <rect width="36" height="36" rx="8" fill="url(#naGrad)" />
        <path
          d="M10 26V10L18 22L26 10V26"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className="na-brand-text">NEWTON ATHENA</span>
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateSessionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'NA-';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function formatElapsed(seconds) {
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatCheckTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ── Progress Indicator ────────────────────────────────────────────────────────

function ProgressIndicator({ activeStep, cameraStatus, screenStatus }) {
  const isReady = cameraStatus === 'connected' && screenStatus === 'connected';
  return (
    <div className="progress-steps-bar">
      <div className={`progress-step ${activeStep === 1 ? 'is-active' : ''} ${cameraStatus === 'connected' ? 'is-complete' : ''}`}>
        <span className="step-num">{cameraStatus === 'connected' ? '✓' : '1'}</span>
        <span className="step-label">Camera</span>
      </div>
      <div className="progress-step-divider" />
      <div className={`progress-step ${activeStep === 2 ? 'is-active' : ''} ${screenStatus === 'connected' ? 'is-complete' : ''}`}>
        <span className="step-num">{screenStatus === 'connected' ? '✓' : '2'}</span>
        <span className="step-label">Screen</span>
      </div>
      <div className="progress-step-divider" />
      <div className={`progress-step ${activeStep === 3 ? 'is-active' : ''} ${isReady ? 'is-complete' : ''}`}>
        <span className="step-num">{isReady ? '✓' : '3'}</span>
        <span className="step-label">Ready</span>
      </div>
    </div>
  );
}

// ── Camera Check Modal ───────────────────────────────────────────────────────

function CameraCheckModal({ currentStream, onCameraVerified, onBack }) {
  const [status, setStatus] = useState(currentStream ? 'connected' : 'requesting');
  const [errorMessage, setErrorMessage] = useState('');
  const [deviceName, setDeviceName] = useState('Using your built-in camera.');
  const [retryKey, setRetryKey] = useState(0);

  const videoRef = useRef(null);
  const localStreamRef = useRef(currentStream || null);

  useEffect(() => {
    let isCancelled = false;

    async function initCamera() {
      if (localStreamRef.current && retryKey === 0) {
        if (videoRef.current) videoRef.current.srcObject = localStreamRef.current;
        return;
      }

      setStatus('requesting');
      setErrorMessage('');

      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('MediaDevicesUnsupported');

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack?.label) setDeviceName(`Using: ${videoTrack.label}`);

        setStatus('connected');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (isCancelled) return;
        setStatus('error');
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage('Camera access was denied. Please allow camera permission in system settings.');
        } else {
          setErrorMessage('Unable to access camera. Please check your device connection.');
        }
      }
    }

    initCamera();
    return () => { isCancelled = true; };
  }, [retryKey]);

  useEffect(() => {
    if (status === 'connected' && localStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = localStreamRef.current;
    }
  }, [status]);

  function handleConfirm() {
    if (localStreamRef.current) onCameraVerified(localStreamRef.current, deviceName);
  }

  return (
    <div className="na-card">
      <div className="na-header"><NaLogo /></div>

      <div className="step-header">
        <div>
          <h2 className="step-title">Camera Verification</h2>
          <p className="step-desc">Verify your webcam is connected and working before the assessment.</p>
        </div>
      </div>

      <hr className="na-divider" />

      <div className="device-row">
        <div className="device-info">
          <div className="device-icon-box"><CameraIcon /></div>
          <div className="device-text">
            <h3 className="device-title">Webcam</h3>
            <p className="device-desc">Camera must be active during the entire assessment.</p>

            {status === 'connected' && (
              <div className="permission-status">
                <div className="permission-badge"><CheckIcon /><span>Camera Connected</span></div>
                <p className="device-subtext">{deviceName}</p>
              </div>
            )}
            {status === 'requesting' && (
              <div className="permission-status">
                <div className="permission-requesting">
                  <div className="mini-spinner" />
                  <span>Requesting camera access…</span>
                </div>
              </div>
            )}
            {status === 'error' && (
              <div className="permission-status">
                <div className="permission-error"><span>✖ {errorMessage}</span></div>
                <button className="btn-retry" onClick={() => setRetryKey((k) => k + 1)}>Try Again</button>
              </div>
            )}
          </div>
        </div>

        <div className="preview-container">
          {status === 'connected' ? (
            <video ref={videoRef} autoPlay muted playsInline className="live-video-feed" />
          ) : (
            <div className="preview-placeholder"><span>Camera preview unavailable</span></div>
          )}
        </div>
      </div>

      <hr className="na-divider" />

      <div className="btn-navigation-row">
        <button id="camera-back-btn" className="btn-action-ghost" onClick={onBack}>Back</button>
        <button id="confirm-camera-btn" className="btn-action-primary" disabled={status !== 'connected'} onClick={handleConfirm}>
          Confirm Camera
        </button>
      </div>
    </div>
  );
}

// ── Screen Sharing Modal ─────────────────────────────────────────────────────

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

  useEffect(() => {
    async function checkPermission() {
      if (window.electronAPI?.getScreenAccessStatus) {
        try {
          const access = await window.electronAPI.getScreenAccessStatus();
          if (access === 'denied') {
            setNeedsSystemPermission(true);
            setStatusMessage('macOS Screen Recording permission is required. Please enable it in System Settings.');
          }
        } catch (_) {}
      }
    }
    checkPermission();
  }, []);

  async function handleShareScreen() {
    setStatus('waiting');
    setStatusMessage('');
    setNeedsSystemPermission(false);

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('DisplayMediaUnsupported');

      if (window.electronAPI?.getScreenAccessStatus) {
        const access = await window.electronAPI.getScreenAccessStatus();
        if (access === 'denied') {
          setStatus('error');
          setNeedsSystemPermission(true);
          setStatusMessage('Screen Recording permission is disabled in macOS System Settings.');
          return;
        }
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });

      localStreamRef.current = stream;
      setStatus('connected');
      setStatusMessage('Screen sharing connected');
      setNeedsSystemPermission(false);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      let isSystemDenied = false;
      if (window.electronAPI?.getScreenAccessStatus) {
        try {
          const access = await window.electronAPI.getScreenAccessStatus();
          if (access === 'denied' || access === 'restricted') isSystemDenied = true;
        } catch (_) {}
      }

      if (isSystemDenied) {
        setStatus('error');
        setNeedsSystemPermission(true);
        setStatusMessage('macOS Screen Recording permission required. Please enable it in System Settings.');
      } else if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        setStatus('not-started');
        setStatusMessage('Screen sharing was cancelled. Please select a screen to continue.');
      } else {
        setStatus('error');
        setStatusMessage('Screen sharing is unavailable. Please check your system permissions.');
      }
    }
  }

  function handleOpenSettings() {
    if (window.electronAPI?.openScreenSecuritySettings) window.electronAPI.openScreenSecuritySettings();
  }

  function handleConfirm() {
    if (localStreamRef.current) onScreenVerified(localStreamRef.current);
  }

  return (
    <div className="na-card">
      <div className="na-header"><NaLogo /></div>

      <div className="step-header">
        <div>
          <h2 className="step-title">Screen Sharing Verification</h2>
          <p className="step-desc">Select the screen or window you want to share for the assessment.</p>
        </div>
      </div>

      <hr className="na-divider" />

      <div className="device-row">
        <div className="device-info">
          <div className="device-icon-box"><ScreenIcon /></div>
          <div className="device-text">
            <h3 className="device-title">Screen Capture</h3>
            <p className="device-desc">You must explicitly select a screen or window to share.</p>

            {status === 'connected' && (
              <div className="permission-status">
                <div className="permission-badge"><CheckIcon /><span>Screen Sharing Connected</span></div>
              </div>
            )}
            {status === 'waiting' && (
              <div className="permission-status">
                <div className="permission-requesting">
                  <div className="mini-spinner" />
                  <span>Waiting for permission…</span>
                </div>
              </div>
            )}
            {statusMessage && status !== 'connected' && status !== 'waiting' && (
              <div className="permission-status">
                <div className="permission-notice-box">
                  <span>{statusMessage}</span>
                  {needsSystemPermission && (
                    <button type="button" id="open-settings-btn" className="btn-open-settings" onClick={handleOpenSettings}>
                      Open macOS System Settings
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="share-btn-wrap">
              <button id="share-screen-btn" className="btn-share-screen" onClick={handleShareScreen} disabled={status === 'waiting'}>
                {status === 'connected' ? 'Change Screen' : 'Share Screen'}
              </button>
            </div>
          </div>
        </div>

        <div className="preview-container preview-container--large">
          {status === 'connected' && localStreamRef.current ? (
            <video ref={screenVideoRef} autoPlay muted playsInline className="screen-video-feed" />
          ) : (
            <div className="preview-placeholder"><span>Screen preview unavailable</span></div>
          )}
        </div>
      </div>

      <hr className="na-divider" />

      <div className="btn-navigation-row">
        <button id="screen-back-btn" className="btn-action-ghost" onClick={onBack}>Back</button>
        <button id="confirm-screen-btn" className="btn-action-primary" disabled={status !== 'connected'} onClick={handleConfirm}>
          Confirm Screen
        </button>
      </div>
    </div>
  );
}

// ── End Test Confirmation Dialog ─────────────────────────────────────────────

function EndTestDialog({ onCancel, onConfirm, isEnding }) {
  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <div className="dialog-icon">⚠️</div>
        <h3 className="dialog-title">End Assessment?</h3>
        <p className="dialog-body">
          Are you sure you want to end the assessment? This action cannot be undone. Your session and all screenshot data will be saved.
        </p>
        <div className="dialog-actions">
          <button id="cancel-end-btn" className="btn-action-ghost" onClick={onCancel} disabled={isEnding}>
            Cancel
          </button>
          <button id="confirm-end-btn" className="btn-action-danger" onClick={onConfirm} disabled={isEnding}>
            {isEnding ? 'Ending…' : 'End Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Root Application ─────────────────────────────────────────────────────────

export default function App() {
  // Navigation flow
  const [flow, setFlow] = useState('initial');
  // 'initial' | 'pre-test' | 'camera-check' | 'screen-check' | 'in-progress' | 'completed'

  const [cameraStatus, setCameraStatus] = useState('not-checked');
  const [screenStatus, setScreenStatus] = useState('not-checked');
  const [cameraDeviceName, setCameraDeviceName] = useState('');

  // ── Session state ────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [backendError, setBackendError] = useState('');
  const [pendingSessionId, setPendingSessionId] = useState('');

  const [backendStatus, setBackendStatus] = useState('checking');
  const [lastServerCheck, setLastServerCheck] = useState('');
  const [isCheckingBackend, setIsCheckingBackend] = useState(false);

  const sessionCheckIntervalRef = useRef(null);
  const isCheckingBackendRef = useRef(false);

  // ── End test confirmation dialog ─────────────────────────────────────────
  const [showEndDialog, setShowEndDialog] = useState(false);

  // ── Completed screen summary data ────────────────────────────────────────
  const [completedSummary, setCompletedSummary] = useState(null);

  // ── Active MediaStreams ───────────────────────────────────────────────────
  const [cameraStream, setCameraStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);

  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // ── Questions & answers ──────────────────────────────────────────────────
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionIndex]: optionIndex }

  // ── Screenshot monitoring stats ──────────────────────────────────────────
  const [screenshotCount, setScreenshotCount] = useState(0);
  const [screenshotSequence, setScreenshotSequence] = useState(0);
  const [lastScreenshotTime, setLastScreenshotTime] = useState('');
  const [latestScreenshotUrl, setLatestScreenshotUrl] = useState(null);
  const [latestScreenshotSize, setLatestScreenshotSize] = useState(0);
  const [totalBytesCaptured, setTotalBytesCaptured] = useState(0);
  const [screenshotStatus, setScreenshotStatus] = useState('Inactive');

  // ── Screenshot upload stats ──────────────────────────────────────────────
  const [screenshotUploadStatus, setScreenshotUploadStatus] = useState('idle');
  const [uploadedScreenshotCount, setUploadedScreenshotCount] = useState(0);
  const [failedScreenshotCount, setFailedScreenshotCount] = useState(0);
  const [retriedScreenshotCount, setRetriedScreenshotCount] = useState(0);
  const [currentRetryAttempt, setCurrentRetryAttempt] = useState(0);
  const [lastUploadTime, setLastUploadTime] = useState('');
  const [lastUploadError, setLastUploadError] = useState('');
  const [lastUploadedScreenshotSize, setLastUploadedScreenshotSize] = useState(0);

  const latestScreenshotUrlRef = useRef(null);
  const isUploadingRef = useRef(false);
  const pendingScreenshotRef = useRef(null);
  const retryAbortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  // ── Screenshot preview URL management ───────────────────────────────────

  function clearScreenshotPreview() {
    if (latestScreenshotUrlRef.current) {
      URL.revokeObjectURL(latestScreenshotUrlRef.current);
      latestScreenshotUrlRef.current = null;
    }
    setLatestScreenshotUrl(null);
  }

  function clearPendingScreenshot() {
    pendingScreenshotRef.current = null;
  }

  // ── Sync refs with state ─────────────────────────────────────────────────
  useEffect(() => { cameraStreamRef.current = cameraStream; }, [cameraStream]);
  useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);

  function abortRetryOperations() {
    if (retryAbortControllerRef.current) {
      retryAbortControllerRef.current.abort();
      retryAbortControllerRef.current = null;
    }
  }

  // ── Cleanup helpers ──────────────────────────────────────────────────────

  function cleanupAllStreams() {
    abortRetryOperations();
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    stopScreenshotCapture();
    clearScreenshotPreview();
    clearPendingScreenshot();
    setScreenshotStatus('Inactive');
    setScreenshotUploadStatus('idle');
    setCurrentRetryAttempt(0);
    isUploadingRef.current = false;
    setLatestScreenshotSize(0);
    setTotalBytesCaptured(0);
    setCameraStream(null);
    setScreenStream(null);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopSessionCheck() {
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }
  }

  // ── Unmount cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRetryOperations();
      cleanupAllStreams();
      stopTimer();
      stopSessionCheck();
      stopScreenshotCapture();
      clearScreenshotPreview();
      clearPendingScreenshot();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Timer + session check cleanup on flow change ─────────────────────────
  useEffect(() => {
    return () => {
      stopTimer();
      stopSessionCheck();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Disconnect listeners ─────────────────────────────────────────────────

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
        abortRetryOperations();
        stopScreenshotCapture();
        clearScreenshotPreview();
        clearPendingScreenshot();
        isUploadingRef.current = false;
        setCurrentRetryAttempt(0);
        setScreenshotStatus('Screen sharing stopped');
        setScreenshotUploadStatus('idle');
        setScreenStatus('disconnected');
        setScreenStream(null);
        screenStreamRef.current = null;
      };
    }
  }

  // ── Device verified handlers ─────────────────────────────────────────────

  function handleCameraVerified(stream, deviceName) {
    setCameraStream(stream);
    cameraStreamRef.current = stream;
    setCameraStatus('connected');
    setCameraDeviceName(deviceName);
    attachCameraDisconnectListener(stream);
    setFlow('pre-test');
  }

  function handleScreenVerified(stream) {
    setScreenStream(stream);
    screenStreamRef.current = stream;
    setScreenStatus('connected');
    attachScreenDisconnectListener(stream);
    setFlow('pre-test');
  }

  // ── Session management ───────────────────────────────────────────────────

  async function startSession() {
    if (session?.status === 'active') return;
    if (isStartingSession) return;

    const sessionIdToUse = pendingSessionId || generateSessionId();
    setPendingSessionId(sessionIdToUse);
    setIsStartingSession(true);
    setBackendError('');

    try {
      const response = await createSession(sessionIdToUse);

      const backendSession = response?.session || {
        sessionId: sessionIdToUse,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null,
      };

      setSession(backendSession);
      setPendingSessionId('');

      // Reset all stats for new session
      setElapsed(0);
      setScreenshotCount(0);
      setScreenshotSequence(0);
      resetScreenshotSequence();
      setLastScreenshotTime('');
      setLatestScreenshotSize(0);
      setTotalBytesCaptured(0);
      setScreenshotStatus('Active');
      setUploadedScreenshotCount(0);
      setFailedScreenshotCount(0);
      setRetriedScreenshotCount(0);
      setCurrentRetryAttempt(0);
      setScreenshotUploadStatus('idle');
      setLastUploadTime('');
      setLastUploadedScreenshotSize(0);
      setLastUploadError('');
      isUploadingRef.current = false;
      abortRetryOperations();
      clearPendingScreenshot();
      clearScreenshotPreview();

      // Reset questions
      setCurrentQuestion(0);
      setAnswers({});

      setCompletedSummary(null);
      setShowEndDialog(false);
      setFlow('in-progress');

      // Start timer — one interval only
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start assessment session:', err);
      setBackendError(err.message || 'Unable to connect to the assessment server.');
    } finally {
      setIsStartingSession(false);
    }
  }

  // ── Backend health / periodic session check ──────────────────────────────

  useEffect(() => {
    if (flow !== 'in-progress' || !session?.sessionId) {
      stopSessionCheck();
      return;
    }

    const currentSessionId = session.sessionId;
    setBackendStatus('checking');

    async function runInitialCheck() {
      if (isCheckingBackendRef.current) return;
      isCheckingBackendRef.current = true;
      setIsCheckingBackend(true);

      try {
        await getBackendHealth();
        await getSession(currentSessionId);
        setBackendStatus('connected');
        setLastServerCheck(formatCheckTime(new Date()));
      } catch (err) {
        console.warn('Initial backend check failed:', err.message);
        setBackendStatus('disconnected');
      } finally {
        isCheckingBackendRef.current = false;
        setIsCheckingBackend(false);
      }
    }

    runInitialCheck();
    stopSessionCheck();

    const intervalId = setInterval(async () => {
      if (isCheckingBackendRef.current) return;
      isCheckingBackendRef.current = true;
      try {
        await getSession(currentSessionId);
        setBackendStatus('connected');
        setLastServerCheck(formatCheckTime(new Date()));
      } catch (err) {
        console.warn('Periodic session check failed:', err.message);
        setBackendStatus('disconnected');
      } finally {
        isCheckingBackendRef.current = false;
      }
    }, 10000);

    sessionCheckIntervalRef.current = intervalId;

    return () => { stopSessionCheck(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, session?.sessionId]);

  async function handleRetryConnection() {
    if (isCheckingBackendRef.current) return;
    isCheckingBackendRef.current = true;
    setIsCheckingBackend(true);
    setBackendStatus('checking');

    try {
      await getBackendHealth();
      setBackendStatus('connected');
      setLastServerCheck(formatCheckTime(new Date()));
    } catch (err) {
      console.warn('Backend retry failed:', err.message);
      setBackendStatus('disconnected');
    } finally {
      isCheckingBackendRef.current = false;
      setIsCheckingBackend(false);
    }
  }

  // ── Screenshot capture + upload loop ────────────────────────────────────

  useEffect(() => {
    const isAssessmentActive = flow === 'in-progress' && session?.status === 'active';
    const isScreenLive = screenStream && screenStream.getVideoTracks().some((t) => t.readyState === 'live');

    if (isAssessmentActive && isScreenLive) {
      setScreenshotStatus('Active');

      const processUpload = async (blobToUpload, targetSessionId, metadata) => {
        if (!isMountedRef.current || !blobToUpload || !targetSessionId) return;

        if (isUploadingRef.current) {
          pendingScreenshotRef.current = { blob: blobToUpload, sessionId: targetSessionId, metadata };
          return;
        }

        isUploadingRef.current = true;
        if (isMountedRef.current) {
          setScreenshotUploadStatus('uploading');
          setCurrentRetryAttempt(0);
        }

        const controller = new AbortController();
        retryAbortControllerRef.current = controller;

        try {
          await uploadScreenshotWithRetry(targetSessionId, blobToUpload, metadata, {
            signal: controller.signal,
            onRetry: ({ attempt, error }) => {
              if (!isMountedRef.current || controller.signal.aborted) return;
              setCurrentRetryAttempt(attempt);
              setRetriedScreenshotCount((prev) => prev + 1);
              setScreenshotUploadStatus('Retrying');
              setLastUploadError(error?.message || 'Upload failed, retrying…');
            },
          });

          if (isMountedRef.current && !controller.signal.aborted) {
            setUploadedScreenshotCount((prev) => prev + 1);
            setScreenshotUploadStatus('uploaded');
            setCurrentRetryAttempt(0);
            setLastUploadTime(new Date().toLocaleTimeString());
            setLastUploadedScreenshotSize(blobToUpload.size);
            setLastUploadError('');
          }
        } catch (uploadErr) {
          if (controller.signal.aborted || uploadErr.name === 'AbortError') return;

          console.warn('Screenshot upload permanently failed:', uploadErr?.message);
          if (isMountedRef.current) {
            setFailedScreenshotCount((prev) => prev + 1);
            setLastUploadError(uploadErr?.message || 'Screenshot upload failed');
            setCurrentRetryAttempt(0);
            setScreenshotUploadStatus('Failed');
          }
        } finally {
          retryAbortControllerRef.current = null;
          isUploadingRef.current = false;

          if (pendingScreenshotRef.current && isMountedRef.current) {
            const next = pendingScreenshotRef.current;
            pendingScreenshotRef.current = null;
            processUpload(next.blob, next.sessionId, next.metadata);
          }
        }
      };

      startScreenshotCapture(
        screenStream,
        (blob, metadata) => {
          if (!isMountedRef.current) return;

          const seq = metadata?.sequence || (screenshotSequence + 1);
          setScreenshotSequence(seq);
          setScreenshotCount((prev) => prev + 1);
          setLastScreenshotTime(new Date().toLocaleTimeString());
          if (blob && typeof blob.size === 'number') {
            setLatestScreenshotSize(blob.size);
            setTotalBytesCaptured((prev) => prev + blob.size);
          }
          setScreenshotStatus('Active');

          const newUrl = URL.createObjectURL(blob);
          if (latestScreenshotUrlRef.current) URL.revokeObjectURL(latestScreenshotUrlRef.current);
          latestScreenshotUrlRef.current = newUrl;
          setLatestScreenshotUrl(newUrl);

          const currentSessionId = session?.sessionId;
          if (!currentSessionId) {
            setScreenshotUploadStatus('idle');
            return;
          }

          const screenshotMetadata = {
            sessionId: currentSessionId,
            sequence: seq,
            capturedAt: metadata?.capturedAt || new Date().toISOString(),
            size: blob ? blob.size : 0,
            mimeType: blob?.type || 'image/jpeg',
          };

          processUpload(blob, currentSessionId, screenshotMetadata);
        },
        (err) => {
          if (!isMountedRef.current) return;
          console.warn('Screenshot capture failed:', err?.message);
          setScreenshotStatus('Screenshot capture failed');
        }
      );
    } else {
      abortRetryOperations();
      stopScreenshotCapture();
      clearPendingScreenshot();
      if (!isAssessmentActive) {
        clearScreenshotPreview();
        setScreenshotStatus('Inactive');
        setScreenshotUploadStatus('idle');
        setCurrentRetryAttempt(0);
        isUploadingRef.current = false;
        setLatestScreenshotSize(0);
        setTotalBytesCaptured(0);
      } else if (!isScreenLive) {
        setScreenshotStatus('Screen sharing stopped');
        setScreenshotUploadStatus('idle');
        setCurrentRetryAttempt(0);
      }
    }

    return () => {
      abortRetryOperations();
      stopScreenshotCapture();
      clearPendingScreenshot();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, session?.status, session?.sessionId, screenStream]);

  // ── End test flow ────────────────────────────────────────────────────────

  function handleEndTestClick() {
    setShowEndDialog(true);
  }

  function handleCancelEnd() {
    setShowEndDialog(false);
  }

  async function handleConfirmEnd() {
    if (isEndingSession) return;
    setIsEndingSession(true);

    // Snapshot summary before clearing state
    const summary = {
      sessionId: session?.sessionId,
      duration: elapsed,
      questionsAttempted: Object.keys(answers).length,
      screenshotsCaptured: screenshotCount,
      screenshotsUploaded: uploadedScreenshotCount,
    };

    stopSessionCheck();
    stopTimer();

    if (session?.sessionId) {
      try {
        await endSession(session.sessionId);
      } catch (err) {
        console.warn('Could not end session on backend:', err.message);
      }
    }

    cleanupAllStreams();
    setCameraStatus('not-checked');
    setScreenStatus('not-checked');
    setBackendError('');
    setPendingSessionId('');
    setShowEndDialog(false);
    setIsEndingSession(false);
    setSession(null);
    setCompletedSummary(summary);
    setFlow('completed');
  }

  // ── Back to Home ─────────────────────────────────────────────────────────

  function handleBackToHome() {
    setCompletedSummary(null);
    setAnswers({});
    setCurrentQuestion(0);
    setElapsed(0);
    setScreenshotCount(0);
    setScreenshotSequence(0);
    setUploadedScreenshotCount(0);
    setFailedScreenshotCount(0);
    setRetriedScreenshotCount(0);
    setLastUploadTime('');
    setLastUploadError('');
    setLastUploadedScreenshotSize(0);
    setBackendStatus('checking');
    setLastServerCheck('');
    setFlow('initial');
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getActiveStep() {
    if (flow === 'camera-check') return 1;
    if (flow === 'screen-check') return 2;
    if (cameraStatus === 'connected' && screenStatus === 'connected') return 3;
    if (cameraStatus === 'connected') return 2;
    return 1;
  }

  const isBothConnected = cameraStatus === 'connected' && screenStatus === 'connected';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="na-app">

      {/* ── View 1: Initial / Home Screen ── */}
      {flow === 'initial' && (
        <div className="na-card">
          <div className="na-header"><NaLogo /></div>
          <div className="initial-hero">
            <h1 className="initial-title">Newton Athena</h1>
            <p className="initial-subtitle">Technical Assessment</p>
            <p className="initial-description">
              Complete your assessment while your camera and screen sharing remain active. Screenshots are captured every second to ensure assessment integrity.
            </p>
            <div className="initial-details-box">
              <div className="detail-item">
                <span className="detail-label">Assessment</span>
                <span className="detail-value">Technical Assessment</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Questions</span>
                <span className="detail-value">5 Questions</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Required</span>
                <span className="detail-value">Camera &amp; Screen Sharing</span>
              </div>
            </div>
            <button id="start-test-btn" className="btn-action-primary btn--large" onClick={() => setFlow('pre-test')}>
              Start Test
            </button>
          </div>
        </div>
      )}

      {/* ── View 2: Pre-Test Device Check ── */}
      {flow === 'pre-test' && (
        <div className="na-card">
          <div className="na-header"><NaLogo /></div>

          <ProgressIndicator activeStep={getActiveStep()} cameraStatus={cameraStatus} screenStatus={screenStatus} />

          <div className="step-header" style={{ marginTop: '20px' }}>
            <div>
              <h2 className="step-title">Pre-Test Device Check</h2>
              <p className="step-desc">Verify your camera and screen sharing before starting the assessment.</p>
            </div>
          </div>

          <hr className="na-divider" />

          <div className="device-cards-grid">
            {/* Camera card */}
            <div className={`device-status-card status--${cameraStatus}`}>
              <div className="device-card-header">
                <div className="device-card-icon-title">
                  <div className="mini-icon-circle"><CameraIcon /></div>
                  <h4>Camera</h4>
                </div>
                <span className="device-card-badge">
                  {cameraStatus === 'connected' && '● Connected'}
                  {cameraStatus === 'error' && '✕ Error'}
                  {cameraStatus === 'disconnected' && '✕ Disconnected'}
                  {cameraStatus === 'not-checked' && '○ Not Checked'}
                </span>
              </div>
              <p className="device-card-detail">
                {cameraStatus === 'connected' && (cameraDeviceName || 'Webcam verified and active')}
                {cameraStatus === 'error' && 'Camera permission was denied or device unavailable.'}
                {cameraStatus === 'disconnected' && 'Camera stream stopped. Please recheck.'}
                {cameraStatus === 'not-checked' && 'Webcam access required to monitor the assessment.'}
              </p>
              <button id="check-camera-btn" className="btn-card-action" onClick={() => setFlow('camera-check')}>
                {cameraStatus === 'connected' ? 'Recheck Camera' : 'Check Camera'}
              </button>
            </div>

            {/* Screen sharing card */}
            <div className={`device-status-card status--${screenStatus}`}>
              <div className="device-card-header">
                <div className="device-card-icon-title">
                  <div className="mini-icon-circle"><ScreenIcon /></div>
                  <h4>Screen Sharing</h4>
                </div>
                <span className="device-card-badge">
                  {screenStatus === 'connected' && '● Connected'}
                  {screenStatus === 'error' && '✕ Error'}
                  {screenStatus === 'disconnected' && '✕ Disconnected'}
                  {screenStatus === 'not-checked' && '○ Not Checked'}
                </span>
              </div>
              <p className="device-card-detail">
                {screenStatus === 'connected' && 'Screen capture stream verified and active'}
                {screenStatus === 'error' && 'Screen sharing was cancelled or unavailable.'}
                {screenStatus === 'disconnected' && 'Screen share ended. Please recheck.'}
                {screenStatus === 'not-checked' && 'Screen sharing required before starting the test.'}
              </p>
              <button id="check-screen-btn" className="btn-card-action" onClick={() => setFlow('screen-check')}>
                {screenStatus === 'connected' ? 'Recheck Screen' : 'Check Screen Sharing'}
              </button>
            </div>
          </div>

          <hr className="na-divider" />

          {isBothConnected ? (
            <div className="notice notice--ok">Both devices are ready. You can start the assessment.</div>
          ) : (
            <div className="notice notice--warn">
              {cameraStatus !== 'connected' && screenStatus !== 'connected'
                ? 'Please complete both Camera and Screen Sharing checks before starting.'
                : cameraStatus !== 'connected'
                ? 'Camera check is incomplete. Please verify your camera.'
                : 'Screen Sharing check is incomplete. Please verify screen sharing.'}
            </div>
          )}

          {backendError && (
            <div className="backend-error-box">
              <div className="backend-error-msg"><span>⚠️ {backendError}</span></div>
              <button id="retry-start-btn" className="btn-retry-action" onClick={startSession} disabled={isStartingSession}>
                {isStartingSession ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}

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
              {isStartingSession ? 'Starting…' : 'Start Assessment'}
            </button>
          </div>
        </div>
      )}

      {/* ── View 3: Camera Check ── */}
      {flow === 'camera-check' && (
        <CameraCheckModal
          currentStream={cameraStream}
          onCameraVerified={handleCameraVerified}
          onBack={() => setFlow('pre-test')}
        />
      )}

      {/* ── View 4: Screen Sharing Check ── */}
      {flow === 'screen-check' && (
        <ScreenSharingModal
          currentStream={screenStream}
          onScreenVerified={handleScreenVerified}
          onBack={() => setFlow('pre-test')}
        />
      )}

      {/* ── View 5: Assessment In Progress ── */}
      {flow === 'in-progress' && session && (
        <div className="na-card assessment-card">
          {/* Header */}
          <div className="assessment-header">
            <NaLogo />
            <div className="assessment-header-meta">
              <span className="assessment-header-title">Technical Assessment</span>
              <div className="session-live-badge">
                <span className="pulse-live-dot" />
                <span>LIVE</span>
              </div>
            </div>
          </div>

          <hr className="na-divider" />

          {/* Status bar */}
          <div className="assessment-status-bar">
            <div className="status-bar-item">
              <span className="status-bar-label">Session Status</span>
              <span className="status-active-text">● Active</span>
            </div>
            <div className="status-bar-item">
              <span className="status-bar-label">Timer</span>
              <span className="timer-display">{formatElapsed(elapsed)}</span>
            </div>
            <div className="status-bar-item">
              <span className="status-bar-label">Session ID</span>
              <span className="session-id-mono">{session.sessionId}</span>
            </div>
          </div>

          <hr className="na-divider" />

          {/* Main content: questions + monitoring side panel */}
          <div className="assessment-main-layout">
            {/* Questions panel */}
            <div className="questions-panel">
              <div className="question-meta">
                <span className="question-counter">Question {currentQuestion + 1} of {QUESTIONS.length}</span>
              </div>

              <div className="question-card">
                <p className="question-text">{QUESTIONS[currentQuestion].text}</p>

                <div className="options-list">
                  {QUESTIONS[currentQuestion].options.map((opt, i) => (
                    <button
                      key={i}
                      id={`q${currentQuestion + 1}-opt${i}`}
                      className={`option-btn ${answers[currentQuestion] === i ? 'option-selected' : ''}`}
                      onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion]: i }))}
                    >
                      <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                      <span className="option-text">{opt}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="question-nav-row">
                <button
                  id="prev-question-btn"
                  className="btn-action-ghost btn-sm"
                  disabled={currentQuestion === 0}
                  onClick={() => setCurrentQuestion((q) => q - 1)}
                >
                  ← Previous
                </button>

                <div className="question-nav-dots">
                  {QUESTIONS.map((_, i) => (
                    <button
                      key={i}
                      id={`nav-q${i + 1}`}
                      className={`nav-dot ${i === currentQuestion ? 'nav-dot--active' : ''} ${answers[i] !== undefined ? 'nav-dot--answered' : ''}`}
                      onClick={() => setCurrentQuestion(i)}
                      title={`Question ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button
                  id="next-question-btn"
                  className="btn-action-ghost btn-sm"
                  disabled={currentQuestion === QUESTIONS.length - 1}
                  onClick={() => setCurrentQuestion((q) => q + 1)}
                >
                  Next →
                </button>
              </div>

              {/* End test button */}
              <div className="end-test-row">
                <button
                  id="end-test-btn"
                  className="btn-action-danger"
                  onClick={handleEndTestClick}
                  disabled={isEndingSession}
                >
                  End Test
                </button>
              </div>
            </div>

            {/* Monitoring panel */}
            <div className="monitoring-panel">
              {/* Camera monitor */}
              <div className="monitor-card">
                <div className="monitor-card-header">
                  <span className="monitor-card-label">Monitoring</span>
                </div>
                <div className="monitor-section">
                  <div className="monitor-row">
                    <CameraIcon />
                    <span className="monitor-label">Camera</span>
                    <span className={`monitor-status-dot ${cameraStatus === 'connected' ? 'dot-green' : 'dot-red'}`} />
                    <span className="monitor-status-text">{cameraStatus === 'connected' ? 'Active' : 'Disconnected'}</span>
                  </div>
                  {cameraStream && (
                    <CameraPreview stream={cameraStream} />
                  )}
                </div>
                <div className="monitor-section">
                  <div className="monitor-row">
                    <ScreenIcon />
                    <span className="monitor-label">Screen</span>
                    <span className={`monitor-status-dot ${screenStatus === 'connected' ? 'dot-green' : 'dot-red'}`} />
                    <span className="monitor-status-text">{screenStatus === 'connected' ? 'Sharing' : 'Stopped'}</span>
                  </div>
                </div>

                {/* Backend status */}
                <div className="monitor-section">
                  <div className="monitor-row">
                    <span className="monitor-label">Backend</span>
                    <span
                      className={`monitor-status-dot ${
                        backendStatus === 'connected' ? 'dot-green' : backendStatus === 'checking' ? 'dot-amber' : 'dot-red'
                      }`}
                    />
                    <span className="monitor-status-text">
                      {backendStatus === 'connected' ? 'Connected' : backendStatus === 'checking' ? 'Checking…' : 'Disconnected'}
                    </span>
                  </div>
                  {backendStatus === 'disconnected' && (
                    <button
                      id="retry-connection-btn"
                      className="btn-retry btn-sm"
                      onClick={handleRetryConnection}
                      disabled={isCheckingBackend}
                    >
                      {isCheckingBackend ? 'Checking…' : 'Retry'}
                    </button>
                  )}
                </div>
              </div>

              {/* Screenshot stats */}
              <div className="monitor-card">
                <div className="monitor-card-header">
                  <span className="monitor-card-label">Screenshots</span>
                  <span className={`monitor-pill ${screenshotStatus === 'Active' ? 'pill-green' : 'pill-amber'}`}>
                    {screenshotStatus === 'Active' ? '● 1/sec' : '⏸ Paused'}
                  </span>
                </div>
                <div className="screenshot-stats-grid">
                  <div className="ss-stat">
                    <span className="ss-stat-label">Captured</span>
                    <span className="ss-stat-value" id="screenshot-count-display">{screenshotCount}</span>
                  </div>
                  <div className="ss-stat">
                    <span className="ss-stat-label">Uploaded</span>
                    <span className="ss-stat-value" id="screenshot-uploaded-count">{uploadedScreenshotCount}</span>
                  </div>
                  <div className="ss-stat">
                    <span className="ss-stat-label">Sequence</span>
                    <span className="ss-stat-value" id="screenshot-latest-sequence">
                      {screenshotSequence > 0 ? `#${screenshotSequence}` : '--'}
                    </span>
                  </div>
                  <div className="ss-stat">
                    <span className="ss-stat-label">Size</span>
                    <span className="ss-stat-value" id="screenshot-latest-size">
                      {latestScreenshotSize ? formatFileSize(latestScreenshotSize) : '--'}
                    </span>
                  </div>
                  <div className="ss-stat">
                    <span className="ss-stat-label">Upload</span>
                    <span
                      className={`ss-stat-value ${
                        screenshotUploadStatus === 'uploaded' ? 'upload-status-ok'
                        : screenshotUploadStatus === 'Retrying' ? 'upload-status-retrying'
                        : screenshotUploadStatus === 'Failed' ? 'upload-status-err'
                        : ''
                      }`}
                      id="screenshot-upload-status"
                    >
                      {screenshotUploadStatus === 'uploaded' ? 'Uploaded'
                        : screenshotUploadStatus === 'Retrying' ? `Retrying (${currentRetryAttempt}/${MAX_SCREENSHOT_RETRIES})`
                        : screenshotUploadStatus === 'uploading' ? 'Uploading…'
                        : screenshotUploadStatus === 'Failed' ? 'Failed'
                        : 'Idle'}
                    </span>
                  </div>
                  <div className="ss-stat">
                    <span className="ss-stat-label">Last Upload</span>
                    <span className="ss-stat-value" id="screenshot-last-upload-time">{lastUploadTime || '--'}</span>
                  </div>
                </div>

                {lastUploadError && screenshotUploadStatus !== 'uploaded' && (
                  <div className="screenshot-error-banner" id="screenshot-upload-error-banner">
                    <span>⚠️ {lastUploadError}</span>
                  </div>
                )}

                {/* Mini screenshot preview */}
                {latestScreenshotUrl && (
                  <div className="ss-mini-preview">
                    <img
                      id="screenshot-preview-img"
                      src={latestScreenshotUrl}
                      alt="Latest Capture"
                      className="ss-mini-preview-img"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── End Test Confirmation Dialog ── */}
      {showEndDialog && (
        <EndTestDialog
          onCancel={handleCancelEnd}
          onConfirm={handleConfirmEnd}
          isEnding={isEndingSession}
        />
      )}

      {/* ── View 6: Assessment Completed ── */}
      {flow === 'completed' && completedSummary && (
        <div className="na-card">
          <div className="na-header"><NaLogo /></div>

          <div className="completed-hero">
            <div className="completed-icon">✓</div>
            <h1 className="completed-title">Assessment Completed</h1>
            <p className="completed-subtitle">Your assessment session has ended successfully.</p>
          </div>

          <hr className="na-divider" />

          <div className="completed-stats-grid">
            <div className="completed-stat">
              <span className="completed-stat-label">Questions Attempted</span>
              <span className="completed-stat-value">{completedSummary.questionsAttempted} / {QUESTIONS.length}</span>
            </div>
            <div className="completed-stat">
              <span className="completed-stat-label">Duration</span>
              <span className="completed-stat-value">{formatElapsed(completedSummary.duration)}</span>
            </div>
            <div className="completed-stat">
              <span className="completed-stat-label">Screenshots Captured</span>
              <span className="completed-stat-value">{completedSummary.screenshotsCaptured}</span>
            </div>
            <div className="completed-stat">
              <span className="completed-stat-label">Screenshots Uploaded</span>
              <span className="completed-stat-value">{completedSummary.screenshotsUploaded}</span>
            </div>
            <div className="completed-stat">
              <span className="completed-stat-label">Session ID</span>
              <span className="completed-stat-value session-id-mono">{completedSummary.sessionId}</span>
            </div>
            <div className="completed-stat">
              <span className="completed-stat-label">Session Status</span>
              <span className="completed-stat-value status-completed-text">Completed</span>
            </div>
          </div>

          <hr className="na-divider" />

          <div className="btn-navigation-row" style={{ justifyContent: 'center' }}>
            <button id="back-to-home-btn" className="btn-action-primary" onClick={handleBackToHome}>
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Camera Preview (small, inline) ───────────────────────────────────────────

function CameraPreview({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="camera-mini-preview"
      id="camera-mini-preview"
    />
  );
}
