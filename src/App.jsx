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

// ── Screen Preview Thumbnail Mockup ──────────────────────────────────────────
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

// ── Main Component ──────────────────────────────────────────────────────────
export default function App() {
  const [cameraStatus, setCameraStatus] = useState('requesting'); // 'requesting' | 'connected' | 'denied' | 'unavailable'
  const [errorMessage, setErrorMessage] = useState('');
  const [deviceName, setDeviceName] = useState('Using your Native MacBook camera.');
  const [retryKey, setRetryKey] = useState(0);
  const [isTestContinued, setIsTestContinued] = useState(false);

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

        // Request video only — no audio/microphone
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        // Extract device name if available
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

        console.warn('Camera error:', err);

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

  // Ensure srcObject is attached when camera becomes connected
  useEffect(() => {
    if (cameraStatus === 'connected' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraStatus]);

  function handleTryAgain() {
    setRetryKey((prev) => prev + 1);
  }

  function handleContinue() {
    setIsTestContinued(true);
  }

  function handleBack() {
    setIsTestContinued(false);
  }

  return (
    <div className="heimdall-app">
      <div className="heimdall-card">

        {/* ── Top Header Logo ── */}
        <div className="heimdall-header">
          <HeimdallLogo />
        </div>

        {/* ── Section 1: Turn on Your Camera ── */}
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

              {cameraStatus === 'denied' && (
                <div className="permission-status">
                  <div className="permission-error">
                    <span className="error-dot">✖</span>
                    <span>Camera permission denied</span>
                  </div>
                  <p className="device-subtext">{errorMessage}</p>
                  <button className="btn-retry" onClick={handleTryAgain}>
                    Try Again
                  </button>
                </div>
              )}

              {cameraStatus === 'unavailable' && (
                <div className="permission-status">
                  <div className="permission-error">
                    <span className="error-dot">✖</span>
                    <span>Camera unavailable</span>
                  </div>
                  <p className="device-subtext">{errorMessage}</p>
                  <button className="btn-retry" onClick={handleTryAgain}>
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Camera Preview Box */}
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

        {/* ── Section 2: Share your Entire Screen ── */}
        <div className="device-row">
          <div className="device-info">
            <div className="device-icon-box">
              <ScreenIcon />
            </div>
            <div className="device-text">
              <h2 className="device-title">Share your Entire Screen</h2>
              <p className="device-desc">Kindly do the screen share of your entire screen.</p>
              <div className="permission-status">
                <div className="permission-badge">
                  <CheckIcon />
                  <span>Permission Given</span>
                </div>
              </div>
            </div>
          </div>

          {/* Screen Share Preview Box */}
          <div className="preview-container">
            <ScreenPreviewThumbnail />
          </div>
        </div>

        <hr className="heimdall-divider" />

        {/* ── Section 3: Privacy Policy ── */}
        <div className="privacy-section">
          <h3 className="privacy-title">Privacy Policy</h3>
          <p className="privacy-text">
            Proctor reports generated from screen share, camera recordings, and system activity during assessments are securely stored to uphold academic integrity, enable audits, dispute resolution, and meet compliance requirements, including those set by the UGC.
          </p>
          <p className="privacy-text">
            Reports remain in active storage for up to 6 months and may be securely retained longer to meet academic, compliance, or legal obligations. Access is strictly restricted to authorized personnel.
          </p>
        </div>

      </div>

      {/* ── Bottom Active Banner ── */}
      <div className="active-banner-container">
        <p className="active-running-text">
          Heimdall is currently active and running. Go to Newton Athena to continue the test.
        </p>

        {/* Control row for assessment actions */}
        <div className="footer-actions">
          {isTestContinued ? (
            <div className="device-check-banner">
              <span className="check-done-badge">Device Check Completed</span>
              <button className="btn-action-ghost" onClick={handleBack}>
                Back to Monitoring
              </button>
            </div>
          ) : (
            <button
              id="continue-test-btn"
              className="btn-action-primary"
              disabled={cameraStatus !== 'connected'}
              onClick={handleContinue}
            >
              Continue to Assessment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
