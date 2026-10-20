import { useState, useRef, useEffect } from 'react';
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

// ── Screen Preview Mockup Thumbnail ─────────────────────────────────────────
function ScreenPreviewThumbnail() {
  return (
    <div className="screen-preview-card">
      <div className="mini-window">
        <div className="mini-window-bar">
          <span className="mini-win-dot dot-red" />
          <span className="mini-win-dot dot-yellow" />
          <span className="mini-win-dot dot-green" />
          <span className="mini-win-title">Heimdall is monitoring your test</span>
        </div>
        <div className="mini-window-body">
          <div className="mini-col-left">
            <div className="mini-badge-row">
              <span className="mini-green-dot" />
              <span className="mini-badge-text" />
            </div>
            <div className="mini-line w-80" />
            <div className="mini-line w-60" />
            <div className="mini-line w-40" />
          </div>
          <div className="mini-col-right">
            <div className="mini-cam-feed">
              <div className="mini-person-silhouette" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Camera Check Section ────────────────────────────────────────────
function CameraCheckView({ onContinue }) {
  const [cameraStatus, setCameraStatus] = useState('requesting');
  const [errorMessage, setErrorMessage] = useState('');
  const [deviceName, setDeviceName] = useState('Using your Native MacBook camera.');
  const [retryKey, setRetryKey] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function initCamera() {
      stopCamera();
      setCameraStatus('requesting');
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
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.label) {
          setDeviceName(`Using your ${videoTrack.label}.`);
        } else {
          setDeviceName('Using your Native MacBook camera.');
        }

        setCameraStatus('connected');

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.warn('Video autoPlay prevented:', err);
          });
        }
      } catch (err) {
        if (isCancelled) return;
        console.warn('Camera check error:', err);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraStatus('denied');
          setErrorMessage('Camera access is required to continue with the monitored assessment.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraStatus('unavailable');
          setErrorMessage('No camera device was detected on your system. Please connect a webcam.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraStatus('unavailable');
          setErrorMessage('Your camera is currently being used by another application.');
        } else {
          setCameraStatus('unavailable');
          setErrorMessage('Unable to access camera media stream. Please verify your permissions.');
        }
      }
    }

    initCamera();

    return () => {
      isCancelled = true;
      stopCamera();
    };
  }, [retryKey]);

  useEffect(() => {
    if (cameraStatus === 'connected' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraStatus]);

  function handleContinueClick() {
    stopCamera();
    onContinue();
  }

  return (
    <div className="heimdall-card">
      <div className="heimdall-header">
        <HeimdallLogo />
      </div>

      {/* Row 1: Turn on Your Camera */}
      <div className="device-row">
        <div className="device-info">
          <div className="device-icon-box">
            <CameraIcon />
          </div>
          <div className="device-text">
            <h2 className="device-title">Turn on Your Camera</h2>
            <p className="device-desc">Start your camera to proceed with the test.</p>

            {cameraStatus === 'connected' && (
              <div className="permission-status">
                <div className="permission-badge">
                  <CheckIcon />
                  <span>Permission Given</span>
                </div>
                <p className="device-subtext">{deviceName}</p>
              </div>
            )}

            {cameraStatus === 'requesting' && (
              <div className="permission-status">
                <div className="permission-requesting">
                  <div className="mini-spinner" />
                  <span>Requesting camera permission...</span>
                </div>
              </div>
            )}

            {(cameraStatus === 'denied' || cameraStatus === 'unavailable') && (
              <div className="permission-status">
                <div className="permission-error">
                  <span className="error-dot">✖</span>
                  <span>{cameraStatus === 'denied' ? 'Camera permission denied' : 'Camera unavailable'}</span>
                </div>
                <p className="device-subtext">{errorMessage}</p>
                <button className="btn-retry" onClick={() => setRetryKey((k) => k + 1)}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="preview-container">
          {cameraStatus === 'connected' ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="live-video-feed"
            />
          ) : (
            <div className="preview-placeholder">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <span>Camera preview unavailable</span>
            </div>
          )}
        </div>
      </div>

      <hr className="heimdall-divider" />

      {/* Row 2: Screen Sharing preview row */}
      <div className="device-row">
        <div className="device-info">
          <div className="device-icon-box">
            <ScreenIcon />
          </div>
          <div className="device-text">
            <h2 className="device-title">Share your Entire Screen</h2>
            <p className="device-desc">Kindly do the screen share of your entire screen.</p>
            <div className="permission-status">
              <span className="permission-badge-pending">● Configured in next step</span>
            </div>
          </div>
        </div>

        <div className="preview-container">
          <ScreenPreviewThumbnail />
        </div>
      </div>

      <hr className="heimdall-divider" />

      {/* Privacy Policy */}
      <div className="privacy-section">
        <h3 className="privacy-title">Privacy Policy</h3>
        <p className="privacy-text">
          Proctor reports generated from screen share, camera recordings, and system activity during assessments are securely stored to uphold academic integrity, enable audits, dispute resolution, and meet compliance requirements, including those set by the UGC.
        </p>
        <p className="privacy-text">
          Reports remain in active storage for up to 6 months and may be securely retained longer to meet academic, compliance, or legal obligations. Access is strictly restricted to authorized personnel.
        </p>
      </div>

      <div className="card-actions-row">
        <button
          id="continue-to-screen-btn"
          className="btn-action-primary"
          disabled={cameraStatus !== 'connected'}
          onClick={handleContinueClick}
        >
          Continue to Screen Sharing
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Screen Sharing Check (Commit 5) ──────────────────────────────────
function ScreenSharingCheckView({ onBack, onContinue }) {
  // Requirement 2: React state managing:
  // 'not-started' | 'waiting' | 'selected' | 'denied' | 'unavailable'
  const [screenStatus, setScreenStatus] = useState('not-started');
  const [statusMessage, setStatusMessage] = useState('');
  const [screenStream, setScreenStream] = useState(null);

  const screenVideoRef = useRef(null);
  const streamRef = useRef(null);

  // Requirement 11: Cleanup helper to stop all screen tracks
  function stopScreenStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScreenStream(null);
  }

  // Requirement 11: Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopScreenStream();
    };
  }, []);

  // Bind video element when screen stream becomes active
  useEffect(() => {
    if (screenStatus === 'selected' && screenStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch((err) => {
        console.warn('Screen video autoPlay error:', err);
      });
    }
  }, [screenStatus, screenStream]);

  // Requirement 3 & 10: Explicit user selection using standard getDisplayMedia
  async function handleShareScreen() {
    stopScreenStream();
    setScreenStatus('waiting');
    setStatusMessage('');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('DisplayMediaUnsupported');
      }

      // Requirement 3: Request screen display media, video only
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;
      setScreenStream(stream);
      setScreenStatus('selected');
      setStatusMessage('Screen sharing connected');

      // Requirement 12: Detect manual stop via browser/OS controls
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenStream();
          setScreenStatus('unavailable');
          setStatusMessage('Screen sharing stopped');
        };
      }
    } catch (err) {
      console.warn('getDisplayMedia result:', err.name || err.message);

      // Requirement 8: User cancelled the screen-share dialog
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        setScreenStatus('not-started');
        setStatusMessage('Screen sharing was not selected.');
      } else if (err.name === 'SecurityError' || err.name === 'PermissionDeniedError') {
        // Requirement 2: Permission Denied
        setScreenStatus('denied');
        setStatusMessage('Screen sharing permission was denied.');
      } else {
        // Requirement 2 & 9: Screen Unavailable / Error
        setScreenStatus('unavailable');
        setStatusMessage('Unable to access screen sharing. Please check system permissions.');
      }
    }
  }

  function handleBackClick() {
    stopScreenStream();
    onBack();
  }

  function handleContinueClick() {
    onContinue();
  }

  // Status labels for Requirement 2
  function getStatusLabel(status) {
    switch (status) {
      case 'not-started':
        return 'Not Started';
      case 'waiting':
        return 'Waiting for Permission';
      case 'selected':
        return 'Screen Selected';
      case 'denied':
        return 'Permission Denied';
      case 'unavailable':
        return 'Screen Unavailable';
      default:
        return 'Not Started';
    }
  }

  // Status indicator text for Requirement 5
  function getIndicatorBadge(status) {
    switch (status) {
      case 'selected':
        return (
          <div className="status-indicator-badge badge-green">
            <span className="indicator-bullet">●</span>
            <span>Screen Selected</span>
          </div>
        );
      case 'waiting':
        return (
          <div className="status-indicator-badge badge-yellow">
            <span className="indicator-bullet">●</span>
            <span>Waiting for Permission</span>
          </div>
        );
      case 'denied':
        return (
          <div className="status-indicator-badge badge-red">
            <span className="indicator-bullet">●</span>
            <span>Permission Denied</span>
          </div>
        );
      case 'unavailable':
        return (
          <div className="status-indicator-badge badge-red">
            <span className="indicator-bullet">●</span>
            <span>Screen Unavailable</span>
          </div>
        );
      default:
        return (
          <div className="status-indicator-badge badge-gray">
            <span className="indicator-bullet">●</span>
            <span>Not Started</span>
          </div>
        );
    }
  }

  return (
    <div className="heimdall-card">
      <div className="heimdall-header">
        <HeimdallLogo />
      </div>

      {/* Requirement 1: Screen Sharing Check title & description */}
      <div className="step-header">
        <div className="step-header-text">
          <h2 className="step-title">Screen Sharing Check</h2>
          <p className="step-desc">
            Screen sharing is required for this monitored assessment. You will be asked to select the screen or window you want to share.
          </p>
        </div>
        {getIndicatorBadge(screenStatus)}
      </div>

      <hr className="heimdall-divider" />

      {/* Requirement 2 & 4: Status row & preview card */}
      <div className="device-row">
        <div className="device-info">
          <div className="device-icon-box">
            <ScreenIcon />
          </div>
          <div className="device-text">
            <h3 className="device-title">Screen: {getStatusLabel(screenStatus)}</h3>

            {/* Requirement 4: Screen sharing connected */}
            {screenStatus === 'selected' && (
              <div className="permission-status">
                <div className="permission-badge">
                  <CheckIcon />
                  <span>Screen sharing connected</span>
                </div>
                <p className="device-subtext">Live screen capture is active.</p>
              </div>
            )}

            {screenStatus === 'waiting' && (
              <div className="permission-status">
                <div className="permission-requesting">
                  <div className="mini-spinner" />
                  <span>Waiting for permission... Please select a screen.</span>
                </div>
              </div>
            )}

            {statusMessage && screenStatus !== 'selected' && screenStatus !== 'waiting' && (
              <div className="permission-status">
                <div className="permission-notice-box">
                  <span>{statusMessage}</span>
                </div>
              </div>
            )}

            {/* Requirement 3: Share Screen button */}
            <div className="share-btn-wrap">
              <button
                id="share-screen-btn"
                className="btn-share-screen"
                onClick={handleShareScreen}
                disabled={screenStatus === 'waiting'}
              >
                {screenStatus === 'selected' ? 'Change Screen' : 'Share Screen'}
              </button>
            </div>
          </div>
        </div>

        {/* Requirement 4: Video element inside simple preview card */}
        <div className="preview-container preview-container--large">
          {screenStatus === 'selected' && screenStream ? (
            <video
              ref={screenVideoRef}
              autoPlay
              muted
              playsInline
              className="screen-video-feed"
            />
          ) : (
            <div className="preview-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>Screen preview unavailable</span>
            </div>
          )}
        </div>
      </div>

      <hr className="heimdall-divider" />

      {/* Requirement 6 & 7: Back and Continue buttons */}
      <div className="btn-navigation-row">
        <button
          id="back-btn-screen"
          className="btn-action-ghost"
          onClick={handleBackClick}
        >
          Back
        </button>
        <button
          id="continue-btn-screen"
          className="btn-action-primary"
          disabled={screenStatus !== 'selected' || !screenStream}
          onClick={handleContinueClick}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Assessment Ready Confirmation ───────────────────────────────────
function AssessmentReadyView({ onBack }) {
  return (
    <div className="heimdall-card">
      <div className="heimdall-header">
        <HeimdallLogo />
      </div>

      <div className="step-header">
        <div>
          <h2 className="step-title">Assessment Monitoring Active</h2>
          <p className="step-desc">
            All required monitoring permissions (camera & screen sharing) have been verified successfully.
          </p>
        </div>
      </div>

      <hr className="heimdall-divider" />

      <div className="ready-checklist">
        <div className="ready-item">
          <CheckIcon />
          <span>Camera Check Completed</span>
        </div>
        <div className="ready-item">
          <CheckIcon />
          <span>Screen Sharing Check Completed</span>
        </div>
      </div>

      <hr className="heimdall-divider" />

      <div className="btn-navigation-row">
        <button className="btn-action-ghost" onClick={onBack}>
          Back to Screen Check
        </button>
      </div>
    </div>
  );
}

// ── Root App Component ──────────────────────────────────────────────────────
export default function App() {
  // Flow: 'camera' → 'screen-check' → 'ready'
  const [flow, setFlow] = useState('camera');

  return (
    <div className="heimdall-app">
      {flow === 'camera' && (
        <CameraCheckView onContinue={() => setFlow('screen-check')} />
      )}

      {flow === 'screen-check' && (
        <ScreenSharingCheckView
          onBack={() => setFlow('camera')}
          onContinue={() => setFlow('ready')}
        />
      )}

      {flow === 'ready' && (
        <AssessmentReadyView onBack={() => setFlow('screen-check')} />
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
