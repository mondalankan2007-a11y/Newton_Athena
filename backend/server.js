const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────────────────────
// Enable Cross-Origin Resource Sharing for Electron / frontend clients
app.use(cors());

// Parse incoming requests with JSON payloads
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'newton-athena-backend'
  });
});

// API base info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Newton Athena API is running',
    version: '1.0.0'
  });
});

// ── 404 Catch-All Handler ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

// ── Start Server ─────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Newton Athena backend running on port ${PORT}`);
  });
}

module.exports = app;
