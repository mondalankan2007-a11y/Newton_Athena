import './App.css';

function App() {
  function handleStartTest() {
    alert('Test session will start here in a future commit.');
  }

  return (
    <div className="app-container">
      <div className="card">
        {/* Logo / badge */}
        <div className="logo-ring">
          <span className="logo-letter">N</span>
        </div>

        {/* Heading block */}
        <h1 className="app-name">Newton Athena</h1>
        <p className="app-subtitle">Assessment Monitoring System</p>

        <hr className="divider" />

        {/* Description */}
        <p className="app-description">
          A desktop application for monitored online assessments.
        </p>

        {/* Status badge */}
        <div className="status-badge">
          <span className="status-dot" />
          System Ready
        </div>

        {/* CTA */}
        <button
          id="start-test-btn"
          className="start-btn"
          onClick={handleStartTest}
        >
          Start Test
        </button>

        <p className="footer-note">
          Commit 1 of 30 &mdash; Foundation
        </p>
      </div>
    </div>
  );
}

export default App;
