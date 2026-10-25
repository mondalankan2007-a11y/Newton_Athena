# Newton Athena

A modern desktop application for monitored online technical assessments, built with Electron, React, Vite, and Express.

---

## Overview

Newton Athena provides a proctored, privacy-respecting environment for online technical assessments. The application guides candidates through a structured pre-test device verification flow, presents a clean test-taking interface with live questions and timers, and continuously verifies testing integrity via 1-second user-consented screen capture uploads with retry resilience.

```
OPEN APP
   ↓
START TEST
   ↓
CAMERA PERMISSION & PREVIEW
   ↓
SCREEN SHARE PERMISSION
   ↓
PRE-TEST DEVICE CHECK
   ↓
START ASSESSMENT
   ↓
ACTUAL TEST SCREEN
   ├── 5 Technical MCQs + Option Selection
   ├── Live HH:MM:SS Timer
   ├── Floating Camera Mini-Preview
   ├── Live Monitoring Dashboard (Camera, Screen, Backend status)
   └── 1-Second Screen Capture + JPEG Compression + Metadata Upload
   ↓
END TEST (with Confirmation Modal)
   ↓
ASSESSMENT COMPLETED (Summary Stats & Safe Media Teardown)
```

---

## Features

- **Candidate Workflow**:
  - **Homepage**: Clean start screen with clear assessment guidelines and system prerequisites.
  - **Camera Permission**: Live webcam verification with immediate video feedback and status check.
  - **Screen Share Selection**: Explicit user-consented display sharing via `navigator.mediaDevices.getDisplayMedia()`.
  - **Pre-Test Device Check**: Comprehensive status verification of camera, screen share, and backend connectivity before entry.
  - **Live Assessment Screen**:
    - **5 Technical MCQs**: Questions covering JavaScript, React, async patterns, and closures with clickable options and question navigation.
    - **Session Timer**: Persistent `HH:MM:SS` elapsed time counter.
    - **Camera Mini-Preview**: Draggable, compact on-screen video monitor ensuring candidate framing.
    - **Integrity Monitoring Panel**: Displays camera status, screen sharing status, backend connection health, and live screenshot statistics.
  - **Confirmation Dialog**: Modal prompt preventing accidental test submission.
  - **Assessment Completed**: Post-test summary reporting duration, questions answered, total screenshots captured, and total uploaded frames.

- **Proctoring & Screenshot System**:
  - **1-Second Capture Cadence**: Automated screenshot extraction at a strict 1000ms interval.
  - **JPEG Compression**: Client-side canvas-to-JPEG compression to optimize network bandwidth.
  - **Rich Metadata Transmission**: Every upload carries `sessionId`, sequence number (`1, 2, 3...`), client capture timestamp (`capturedAt`), file size, and MIME type.
  - **Bounded Upload Queue**: Single-flight upload concurrency with drop-oldest buffer to prevent unbounded memory growth on slow networks.
  - **Exponential Backoff Retry**: Automatic recovery for transient network interruptions (up to 3 retries at 1s, 2s, 4s).
  - **Graceful Error Handling**: Non-fatal failure logging keeping the assessment functional even during transient backend outages.

- **Privacy & Security**:
  - **Strict Consent**: Captures *only* the screen stream explicitly chosen by the candidate; no hidden or background screen recording.
  - **Full Context Isolation**: Electron `contextIsolation: true` with `nodeIntegration: false` and secure IPC bridging.
  - **Immediate Teardown**: Ending or leaving the assessment terminates all media streams (`MediaStreamTrack.stop()`), stops timers, and cancels pending upload requests.

---

## Technologies

| Layer | Technology |
|---|---|
| Desktop Runtime | Electron 33 |
| UI Framework | React 18 |
| Build Tool | Vite 6 |
| Backend Server | Node.js & Express |
| Upload Handling | Multer |
| Styling | Vanilla CSS (Dark Mode Design System) |
| Packaging | electron-builder |

---

## Project Structure

```
Newton_Athena/
├── backend/
│   ├── routes/
│   │   ├── sessions.js          # Session lifecycle endpoints (create, get, end)
│   │   └── screenshotRoutes.js  # Screenshot upload & metadata storage
│   ├── uploads/
│   │   └── screenshots/         # Per-session screenshot directory
│   └── server.js                # Express API server (port 3001)
├── electron/
│   ├── main.js                  # Electron main process & display capture handlers
│   └── preload.js               # Context bridge (secure IPC)
├── src/
│   ├── components/              # Modular UI components
│   ├── services/
│   │   ├── api.js               # REST client for sessions and screenshot uploads
│   │   ├── screenshotService.js # Canvas frame extraction & JPEG conversion
│   │   └── screenshotScheduler.js # 1-second capture cadence & retry scheduler
│   ├── App.jsx                  # Main application flow coordinator
│   ├── App.css                  # Component styling & layout
│   ├── index.css                # Global design system & theme variables
│   └── main.jsx                 # React root entry point
├── index.html                   # HTML template
├── package.json                 # Dependencies & build scripts
├── vite.config.js               # Vite bundler configuration
└── README.md
```

---

## Installation & Setup

Clone the repository and install all dependencies:

```bash
git clone https://github.com/mondalankan2007-a11y/Newton_Athena.git
cd Newton_Athena
npm install
```

---

## Running in Development

### 1. Start the Backend Server

In a terminal window:

```bash
npm run server
```

The Express API server starts at `http://localhost:3001`:
- `GET /health` — Service health check
- `GET /api` — Service info
- `POST /api/sessions` — Create a new session
- `POST /api/sessions/:sessionId/screenshots` — Upload JPEG screenshots

### 2. Start Electron & React

In a second terminal window:

```bash
npm run dev
```

This concurrently starts the Vite dev server (`http://localhost:5173`) and launches the Electron desktop window.

---

## Building a macOS DMG Installer

Newton Athena uses `electron-builder` to bundle the application into a standalone macOS `.dmg` installer.

### Build Command

```bash
npm run electron:build
```

Or target the DMG directly:

```bash
npx electron-builder --mac dmg --publish never
```

### Build Artifacts

Build outputs are saved to the `dist-electron/` directory:
- `dist-electron/Newton Athena-<version>-<arch>.dmg` — Mountable macOS disk image installer
- `dist-electron/mac-<arch>/Newton Athena.app` — Packaged macOS application bundle

### Installing on macOS

1. Double-click the generated `.dmg` file in `dist-electron/`.
2. Drag **Newton Athena** into your **Applications** folder.
3. Open **Newton Athena** from Applications or Spotlight.
   > **Note on Gatekeeper**: For local builds without an Apple Developer certificate, right-click the application and select **Open**, then click **Open** in the confirmation dialog.

---

## Backend API Reference

### Session Management

#### Create Session
- **Endpoint**: `POST /api/sessions`
- **Request Body**: `{ "sessionId": "NA-123456" }`
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "session": {
      "sessionId": "NA-123456",
      "status": "active",
      "startedAt": "2026-10-25T17:00:00.000Z",
      "endedAt": null
    }
  }
  ```

#### End Session
- **Endpoint**: `PATCH /api/sessions/:sessionId/end`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "session": {
      "sessionId": "NA-123456",
      "status": "completed",
      "startedAt": "2026-10-25T17:00:00.000Z",
      "endedAt": "2026-10-25T17:15:30.000Z"
    }
  }
  ```

### Screenshot Upload & Metadata

#### Upload Screenshot
- **Endpoint**: `POST /api/sessions/:sessionId/screenshots`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `screenshot`: JPEG image file (`image/jpeg`, max 2MB)
  - `sessionId`: Session identifier string
  - `sequence`: Integer sequence number (`1, 2, 3...`)
  - `capturedAt`: ISO 8601 client timestamp
  - `size`: Byte count integer
  - `mimeType`: `"image/jpeg"`
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "screenshot": {
      "id": 1,
      "sequence": 1,
      "filename": "screenshot-000001.jpg",
      "capturedAt": "2026-10-25T17:01:00.123Z",
      "receivedAt": "2026-10-25T17:01:00.250Z",
      "size": 142050,
      "mimeType": "image/jpeg"
    }
  }
  ```

#### Screenshot Statistics
- **Endpoint**: `GET /api/sessions/:sessionId/screenshots/stats`
- **Response (`200 OK`)**:
  ```json
  {
    "sessionId": "NA-123456",
    "count": 45,
    "totalBytes": 6392250
  }
  ```

---

## Security & Privacy Highlights

- **Explicit Screen Capture**: Screen capture uses standard WebRTC `getDisplayMedia()`, requiring the user to explicitly grant permission and select the screen or window.
- **Camera Isolation**: The camera stream is used strictly for on-screen candidate preview verification; camera frames are not uploaded to the screenshot endpoint.
- **Instant Revocation**: When the user ends the test or stops screen sharing, all active media streams are immediately halted via `track.stop()`, and all scheduled timers and network retries are aborted.
- **Strict Context Isolation**: Renderer and Node.js execution environments are isolated (`contextIsolation: true`, `nodeIntegration: false`).

---

## License

MIT
