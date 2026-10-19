import { useState } from 'react';
import './App.css';

/*
  Flow states:
    'idle'        → Initial landing screen
    'preparing'   → After "Start Test" is clicked
    'waiting'     → After "Continue" is clicked (permissions pending)
*/

const ASSESSMENT_INFO = {
  name: 'Electron Application Development',
  duration: '60 Minutes',
  monitoring: 'Camera + Screen',
};

// ── Small helper: coloured dot + label ─────────────────────────────────────
function StatusRow({ label, value, color }) {
  const colors = {
    idle:    '#475569',   // grey
    warn:    '#f59e0b',   // amber
    ok:      '#10b981',   // green
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

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [flow, setFlow] = useState('idle');

  // Derived status labels for each flow state
  const statusMap = {
    idle: {
      camera:  { value: 'Not Started', color: 'idle' },
      screen:  { value: 'Not Started', color: 'idle' },
      test:    { value: 'Not Started', color: 'idle' },
    },
    preparing: {
      camera:  { value: 'Not Started', color: 'idle' },
      screen:  { value: 'Not Started', color: 'idle' },
      test:    { value: 'Preparing Test', color: 'warn' },
    },
    waiting: {
      camera:  { value: 'Waiting for Permission', color: 'warn' },
      screen:  { value: 'Waiting for Permission', color: 'warn' },
      test:    { value: 'Waiting for Permissions', color: 'warn' },
    },
  };

  const status = statusMap[flow];

  function handleStartTest() {
    setFlow('preparing');
  }

  function handleContinue() {
    setFlow('waiting');
  }

  function handleBack() {
    setFlow('idle');
  }

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

        {/* ── Flow-dependent content ── */}
        {flow === 'idle' && (
          <div className="flow-block">
            <p className="flow-description">
              This assessment requires <strong>camera</strong> and{' '}
              <strong>screen sharing</strong> permissions for monitoring.
              Please ensure your camera and microphone are connected before starting.
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

        {flow === 'preparing' && (
          <div className="flow-block">
            <div className="notice notice--warn">
              Before starting, you will need to provide camera and screen permissions.
            </div>
            <div className="btn-row">
              <button
                id="back-btn"
                className="btn btn--ghost"
                onClick={handleBack}
              >
                Back
              </button>
              <button
                id="continue-btn"
                className="btn btn--primary"
                onClick={handleContinue}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {flow === 'waiting' && (
          <div className="flow-block">
            <div className="notice notice--info">
              Camera and screen permissions will be requested in the next step.
            </div>
            <button
              id="back-btn-waiting"
              className="btn btn--ghost"
              onClick={handleBack}
            >
              Back to Start
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
