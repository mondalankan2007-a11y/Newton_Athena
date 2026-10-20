import { useState, useRef, useEffect } from 'react';
import './App.css';

/*
  Flow states:
    'idle'          → Initial landing screen
    'preparing'     → Test info & permissions warning
    'camera'        → Dedicated Camera Check & live preview step
    'device-check'  → Intermediate Device Check screen
*/

const ASSESSMENT_INFO = {
  name: 'Electron Application Development',
  duration: '60 Minutes',
  monitoring: 'Camera + Screen',
};

// ── StatusRow: coloured dot + label ─────────────────────────────────────────
function StatusRow({ label, value, color }) {
  const colors = {
    idle:  '#475569',   // slate grey
    warn:  '#f59e0b',   // amber
    ok:    '#10b981',   // emerald green
    error: '#ef4444',   // rose red
  };
  return (
    <div className="status-row">
      <span className="status-row__label">{label}</span>
      <span className="status-row__value" style={{ color: colors[color] || colors.idle }}>
        <span className="status-row__dot" style={{ background: colors[color] || colors.idle }} />
        {value}
      </span>
    </div>
  );
}

// ── CameraCheckStep: Dedicated camera setup & verification section ──────────
function CameraCheckStep({ onCameraStatusChange, onBack, onContinue }) {
  // Requirement 1: React state managing:
  // 'not-checked' | 'requesting' | 'connected' | 'denied' | 'unavailable'
  const [cameraStatus, setCameraStatus] = useState('not-checked');
  const [errorMessage, setErrorMessage] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Requirement 8: Helper to stop active camera tracks properly
  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraStream(null);
  }

  useEffect(() => {
    let isCancelled = false;

    async function requestCamera() {
      // Ensure any existing camera stream is stopped before requesting again
      stopStream();

      setCameraStatus('requesting');
      setErrorMessage('');
      onCameraStatusChange('requesting');

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MediaDevicesUnsupported');
        }

        // Video only — never microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (isCancelled) {
          // If unmounted or cancelled while awaiting getUserMedia, clean up immediately
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setCameraStream(stream);
        setCameraStatus('connected');
        onCameraStatusChange('connected');
      } catch (err) {
        if (isCancelled) return;

        console.warn('Camera access check result:', err.name || err.message);

        // Requirement 4: Handle possible errors separately without raw technical errors
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraStatus('denied');
          setErrorMessage('Camera access is required to continue with the monitored assessment.');
          onCameraStatusChange('denied');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraStatus('unavailable');
          setErrorMessage('No camera device was detected on your system. Please connect a webcam and try again.');
          onCameraStatusChange('unavailable');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraStatus('unavailable');
          setErrorMessage('Your camera is currently being used by another application. Please close other apps and try again.');
          onCameraStatusChange('unavailable');
        } else {
          setCameraStatus('unavailable');
          setErrorMessage('Unable to access camera media stream. Please verify your system permissions and try again.');
          onCameraStatusChange('unavailable');
        }
      }
    }

    requestCamera();

    // Requirement 8: Stop stream when unmounting or before retry
    return () => {
      isCancelled = true;
      stopStream();
    };
  }, [retryKey]);

  // Bind video element when connected and stream is active
  useEffect(() => {
    if (cameraStatus === 'connected' && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => {
        console.warn('Video autoPlay prevented:', err);
      });
    }
  }, [cameraStatus, cameraStream]);

  // Requirement 3: Try Again requests camera permission again
  function handleTryAgain() {
    setRetryKey((prev) => prev + 1);
  }

  // Requirement 8: Stop stream on leaving the camera screen
  function handleBackClick() {
    stopStream();
    onBack();
  }

  function handleContinueClick() {
    stopStream();
    onContinue();
  }

  // Requirement 1: Status display labels
  function getStatusLabel(status) {
    switch (status) {
      case 'not-checked':
        return 'Not checked';
      case 'requesting':
        return 'Requesting permission';
      case 'connected':
        return 'Camera connected';
      case 'denied':
        return 'Permission denied';
      case 'unavailable':
        return 'Camera unavailable';
      default:
        return 'Not checked';
    }
  }

  // Requirement 2: Status indicator badge text
  function getIndicatorText(status) {
    switch (status) {
      case 'connected':
        return 'Camera Connected';
      case 'denied':
        return 'Camera Permission Required';
      case 'unavailable':
        return 'Camera Unavailable';
      case 'requesting':
        return 'Requesting Permission';
      case 'not-checked':
        return 'Not Checked';
      default:
        return 'Not Checked';
    }
  }

  return (
    <div className="flow-block camera-check-section">
      {/* ── Section Title & Indicator (Requirements 1 & 2) ── */}
      <div className="camera-check-header">
        <div>
          <h3 className="camera-check-title">Camera Check</h3>
          <div className="camera-status-line">
            <span className="camera-status-label">Status: </span>
            <span className={`camera-status-value camera-status-value--${cameraStatus}`}>
              {getStatusLabel(cameraStatus)}
            </span>
          </div>
        </div>

        <div className={`camera-indicator-badge camera-indicator-badge--${cameraStatus}`}>
          <span className="camera-indicator-bullet">●</span>
          <span className="camera-indicator-text">{getIndicatorText(cameraStatus)}</span>
        </div>
      </div>

      {/* ── Status Messages & Try Again Button (Requirements 3 & 4) ── */}
      {cameraStatus === 'requesting' && (
        <div className="camera-notice-box camera-notice-box--requesting">
          <div className="camera-spinner-small" />
          <span>Requesting camera permission...</span>
        </div>
      )}

      {(cameraStatus === 'denied' || cameraStatus === 'unavailable') && (
        <div className="camera-error-box">
          <div className="notice notice--error">
            {cameraStatus === 'denied'
              ? 'Camera access is required to continue with the monitored assessment.'
              : errorMessage}
          </div>
          <button
            id="try-again-btn"
            className="btn btn--secondary btn--sm"
            onClick={handleTryAgain}
          >
            Try Again
          </button>
        </div>
      )}

      {cameraStatus === 'connected' && (
        <div className="notice notice--ok">
          Camera permission granted. Live preview is active.
        </div>
      )}

      {/* ── Camera Preview Card (Requirement 5) ── */}
      <div className="camera-preview-card">
        {cameraStatus === 'connected' && cameraStream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="camera-video-feed"
            />
            <div className="camera-overlay-badge">
              <span className="pulse-dot" /> LIVE PREVIEW
            </div>
          </>
        ) : (
          <div className="camera-preview-empty">
            <svg
              className="camera-empty-icon"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            <p className="camera-empty-text">Camera preview unavailable</p>
          </div>
        )}
      </div>

      {/* ── Action Buttons (Requirement 6) ── */}
      <div className="btn-row">
        <button
          id="back-btn-camera"
          className="btn btn--ghost"
          onClick={handleBackClick}
        >
          Back
        </button>
        <button
          id="continue-btn-camera"
          className="btn btn--primary"
          disabled={cameraStatus !== 'connected' || !cameraStream}
          onClick={handleContinueClick}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Main App Component ──────────────────────────────────────────────────────
export default function App() {
  const [flow, setFlow] = useState('idle');
  const [cameraStatus, setCameraStatus] = useState('not-checked');

  function handleStartTest() {
    setFlow('preparing');
  }

  function handleContinueFromPreparing() {
    setFlow('camera');
  }

  function handleBackToIdle() {
    setCameraStatus('not-checked');
    setFlow('idle');
  }

  function handleBackToPreparing() {
    setCameraStatus('not-checked');
    setFlow('preparing');
  }

  function handleContinueFromCamera() {
    setFlow('device-check');
  }

  // Compute status map for System Status section
  function getSystemStatus() {
    if (flow === 'idle') {
      return {
        camera: { value: 'Not Started', color: 'idle' },
        screen: { value: 'Not Started', color: 'idle' },
        test:   { value: 'Not Started', color: 'idle' },
      };
    }
    if (flow === 'preparing') {
      return {
        camera: { value: 'Not Started', color: 'idle' },
        screen: { value: 'Not Started', color: 'idle' },
        test:   { value: 'Preparing Test', color: 'warn' },
      };
    }
    if (flow === 'camera') {
      let camRow = { value: 'Not checked', color: 'idle' };
      let testRow = { value: 'Device Check', color: 'warn' };

      if (cameraStatus === 'requesting') {
        camRow = { value: 'Requesting permission', color: 'warn' };
        testRow = { value: 'Checking Camera', color: 'warn' };
      } else if (cameraStatus === 'connected') {
        camRow = { value: 'Camera connected', color: 'ok' };
        testRow = { value: 'Camera Ready', color: 'ok' };
      } else if (cameraStatus === 'denied') {
        camRow = { value: 'Permission denied', color: 'error' };
        testRow = { value: 'Action Required', color: 'warn' };
      } else if (cameraStatus === 'unavailable') {
        camRow = { value: 'Camera unavailable', color: 'error' };
        testRow = { value: 'Camera Unavailable', color: 'error' };
      }

      return {
        camera: camRow,
        screen: { value: 'Not Started', color: 'idle' },
        test:   testRow,
      };
    }
    if (flow === 'device-check') {
      return {
        camera: { value: 'Camera connected', color: 'ok' },
        screen: { value: 'Not Started', color: 'idle' },
        test:   { value: 'Device Check', color: 'ok' },
      };
    }
    return {
      camera: { value: 'Not Started', color: 'idle' },
      screen: { value: 'Not Started', color: 'idle' },
      test:   { value: 'Not Started', color: 'idle' },
    };
  }

  const status = getSystemStatus();

  return (
    <div className="app-container">
      <div className="card">

        {/* ── Header ── */}
        <div className="header">
          <div className="logo-ring">
            <span className="logo-letter">N</span>
          </div>
          <div className="header__text">
            <h1 className="app-name">Newton Athena</h1>
            <p className="app-subtitle">Assessment Monitoring</p>
          </div>
        </div>

        <hr className="divider" />

        {/* ── Assessment Info ── */}
        <section className="info-section">
          <h2 className="section-title">Assessment Details</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-item__key">Assessment</span>
              <span className="info-item__value">{ASSESSMENT_INFO.name}</span>
            </div>
            <div className="info-item">
              <span className="info-item__key">Duration</span>
              <span className="info-item__value">{ASSESSMENT_INFO.duration}</span>
            </div>
            <div className="info-item">
              <span className="info-item__key">Monitoring</span>
              <span className="info-item__value">{ASSESSMENT_INFO.monitoring}</span>
            </div>
          </div>
        </section>

        <hr className="divider" />

        {/* ── Status Panel ── */}
        <section className="status-section">
          <h2 className="section-title">System Status</h2>
          <StatusRow label="Camera"        {...status.camera} />
          <StatusRow label="Screen Sharing" {...status.screen} />
          <StatusRow label="Test Status"   {...status.test}  />
        </section>

        <hr className="divider" />

        {/* ── Flow: Idle Stage ── */}
        {flow === 'idle' && (
          <div className="flow-block">
            <p className="flow-description">
              This assessment requires <strong>camera</strong> and{' '}
              <strong>screen sharing</strong> permissions for monitoring.
              Please ensure your camera is connected before starting.
            </p>
            <button
              id="start-test-btn"
              className="btn btn--primary"
              onClick={handleStartTest}
            >
              Start Test
            </button>
          </div>
        )}

        {/* ── Flow: Preparing Stage ── */}
        {flow === 'preparing' && (
          <div className="flow-block">
            <div className="notice notice--warn">
              Before starting, you will need to provide camera and screen permissions.
            </div>
            <div className="btn-row">
              <button
                id="back-btn"
                className="btn btn--ghost"
                onClick={handleBackToIdle}
              >
                Back
              </button>
              <button
                id="continue-btn"
                className="btn btn--primary"
                onClick={handleContinueFromPreparing}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Flow: Dedicated Camera Check Step (Commit 4) ── */}
        {flow === 'camera' && (
          <CameraCheckStep
            onCameraStatusChange={setCameraStatus}
            onBack={handleBackToPreparing}
            onContinue={handleContinueFromCamera}
          />
        )}

        {/* ── Flow: Device Check Page (Requirement 7) ── */}
        {flow === 'device-check' && (
          <div className="flow-block device-check-section">
            <h3 className="section-title">Device Check</h3>
            <div className="notice notice--ok">
              Camera check completed.
            </div>
            <p className="flow-description">
              Next, we will check screen sharing.
            </p>
            <div className="btn-row">
              <button
                id="back-btn-device-check"
                className="btn btn--ghost"
                onClick={() => setFlow('camera')}
              >
                Back
              </button>
              <button
                id="reset-btn"
                className="btn btn--secondary"
                onClick={handleBackToIdle}
              >
                Back to Start
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
