import { useState, useRef, useEffect } from 'react';
import './App.css';

/*
  Flow states:
    'idle'        → Initial landing screen
    'preparing'   → After "Start Test" is clicked
    'waiting'     → Camera permission & preview step
    'next'        → Camera verified, ready for next phase
*/

const ASSESSMENT_INFO = {
  name: 'Electron Application Development',
  duration: '60 Minutes',
  monitoring: 'Camera + Screen',
};

// ── StatusRow: coloured dot + label ─────────────────────────────────────────
function StatusRow({ label, value, color }) {
  const colors = {
    idle:  '#475569',   // grey
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

// ── CameraStep: handles camera permission, preview, and track cleanup ────────
function CameraStep({ onCameraStateChange, onBack, onContinue }) {
  const [cameraState, setCameraState] = useState('requesting'); // 'requesting' | 'granted' | 'denied' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;

    async function requestCamera() {
      setCameraState('requesting');
      setErrorMessage('');
      onCameraStateChange('requesting');

      // Stop any existing stream tracks before creating a new one
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MediaDevices API is not supported in this environment.');
        }

        // Requirement 2 & 13: Request video only, never microphone
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
        setCameraState('granted');
        onCameraStateChange('granted');

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.warn('Video autoPlay prevented:', err);
          });
        }
      } catch (err) {
        if (isCancelled) return;

        console.error('Camera access error:', err);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraState('denied');
          setErrorMessage('Camera permission was denied.');
          onCameraStateChange('denied');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraState('error');
          setErrorMessage('No camera device found on this system.');
          onCameraStateChange('error');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraState('error');
          setErrorMessage('Camera is currently in use by another application.');
          onCameraStateChange('error');
        } else {
          setCameraState('error');
          setErrorMessage(err.message || 'Unable to access camera.');
          onCameraStateChange('error');
        }
      }
    }

    requestCamera();

    // Cleanup: stops camera tracks when component unmounts or before retry
    return () => {
      isCancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [retryKey]);

  // Bind video element whenever stream and videoRef are available
  useEffect(() => {
    if (cameraState === 'granted' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraState]);

  function handleTryAgain() {
    setRetryKey((prev) => prev + 1);
  }

  function handleBackClick() {
    // Stop camera tracks immediately when navigating back
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    onBack();
  }

  function handleContinueClick() {
    // Stop camera tracks when moving forward from camera step
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    onContinue();
  }

  // 1. Requesting state
  if (cameraState === 'requesting') {
    return (
      <div className="flow-block">
        <div className="camera-loading-box">
          <div className="camera-spinner" />
          <p className="loading-text">Requesting camera permission...</p>
        </div>
        <button
          id="back-btn-requesting"
          className="btn btn--ghost"
          onClick={handleBackClick}
        >
          Back
        </button>
      </div>
    );
  }

  // 2. Denied state
  if (cameraState === 'denied') {
    return (
      <div className="flow-block">
        <div className="notice notice--error">
          Camera permission was denied.
        </div>
        <p className="flow-description">
          Please enable camera access in your system settings to continue with the assessment.
        </p>
        <div className="btn-row">
          <button
            id="back-btn-denied"
            className="btn btn--ghost"
            onClick={handleBackClick}
          >
            Back
          </button>
          <button
            id="try-again-btn"
            className="btn btn--primary"
            onClick={handleTryAgain}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // 3. Error state
  if (cameraState === 'error') {
    return (
      <div className="flow-block">
        <div className="notice notice--error">
          {errorMessage || 'Unable to access camera.'}
        </div>
        <p className="flow-description">
          Please verify your camera is plugged in and not in use by another application.
        </p>
        <div className="btn-row">
          <button
            id="back-btn-error"
            className="btn btn--ghost"
            onClick={handleBackClick}
          >
            Back
          </button>
          <button
            id="try-again-btn"
            className="btn btn--primary"
            onClick={handleTryAgain}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // 4. Camera Ready section with live preview
  return (
    <div className="flow-block camera-ready-section">
      <div className="camera-header-status">
        <div className="camera-status-badge">
          <span className="camera-status-dot" />
          <span className="camera-status-text">Camera: Connected</span>
        </div>
        <span className="camera-subtext">Camera permission granted</span>
      </div>

      <div className="camera-preview-card">
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
      </div>

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
          onClick={handleContinueClick}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [flow, setFlow] = useState('idle');
  const [cameraState, setCameraState] = useState(null);

  function handleStartTest() {
    setFlow('preparing');
  }

  function handleContinueFromPreparing() {
    setFlow('waiting');
  }

  function handleBackToIdle() {
    setCameraState(null);
    setFlow('idle');
  }

  function handleBackToPreparing() {
    setCameraState(null);
    setFlow('preparing');
  }

  function handleContinueFromCamera() {
    setFlow('next');
  }

  // Derived system status
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
    if (flow === 'waiting') {
      if (cameraState === 'granted') {
        return {
          camera: { value: 'Connected', color: 'ok' },
          screen: { value: 'Not Started', color: 'idle' },
          test:   { value: 'Camera Ready', color: 'ok' },
        };
      }
      if (cameraState === 'denied') {
        return {
          camera: { value: 'Permission Denied', color: 'error' },
          screen: { value: 'Not Started', color: 'idle' },
          test:   { value: 'Action Required', color: 'warn' },
        };
      }
      if (cameraState === 'error') {
        return {
          camera: { value: 'Error', color: 'error' },
          screen: { value: 'Not Started', color: 'idle' },
          test:   { value: 'Camera Error', color: 'error' },
        };
      }
      return {
        camera: { value: 'Requesting...', color: 'warn' },
        screen: { value: 'Not Started', color: 'idle' },
        test:   { value: 'Waiting for Permissions', color: 'warn' },
      };
    }
    if (flow === 'next') {
      return {
        camera: { value: 'Connected (Verified)', color: 'ok' },
        screen: { value: 'Not Started', color: 'idle' },
        test:   { value: 'Ready for Next Step', color: 'ok' },
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

        {/* ── Flow: Camera Permission & Preview Step ── */}
        {flow === 'waiting' && (
          <CameraStep
            onCameraStateChange={setCameraState}
            onBack={handleBackToPreparing}
            onContinue={handleContinueFromCamera}
          />
        )}

        {/* ── Flow: Next Stage (Post-Camera) ── */}
        {flow === 'next' && (
          <div className="flow-block">
            <div className="notice notice--ok">
              Camera verification complete. Next assessment steps will be configured in the next phase.
            </div>
            <div className="btn-row">
              <button
                id="back-to-camera-btn"
                className="btn btn--ghost"
                onClick={() => setFlow('waiting')}
              >
                Back to Camera
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
