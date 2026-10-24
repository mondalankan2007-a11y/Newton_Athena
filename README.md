# Newton Athena

A desktop application for monitored online assessments, built with Electron, React, and Vite.

## Technologies

| Layer        | Technology              |
|-------------|-------------------------|
| Desktop      | Electron 33             |
| UI Framework | React 18                |
| Build Tool   | Vite 6                  |
| Backend      | Node.js / Express 4     |
| Language     | JavaScript (ES Modules & CommonJS) |
| Runtime      | Node.js / npm           |
| Styling      | Vanilla CSS             |

## Project Structure

```
Newton_Athena/
├── backend/
│   ├── routes/
│   │   ├── sessions.js          # Assessment session lifecycle endpoints
│   │   └── screenshotRoutes.js  # Screenshot upload & metadata endpoints
│   ├── uploads/
│   │   └── screenshots/         # Per-session screenshot storage (git-ignored)
│   └── server.js                # Express API server (port 3001)
├── electron/
│   ├── main.js        # Electron main process
│   └── preload.js     # Context bridge (secure IPC)
├── src/
│   ├── main.jsx                 # React entry point
│   ├── App.jsx                  # Homepage & assessment flow component
│   ├── App.css                  # Application styles
│   ├── index.css                # Global styles / reset
│   └── services/
│       ├── api.js               # REST client for backend session & health
│       ├── screenshotService.js # Screen frame extraction & canvas-to-JPEG conversion
│       └── screenshotScheduler.js # 1-second capture loop with overlap protection
├── index.html                   # Vite HTML entry
├── vite.config.js               # Vite configuration
├── package.json
└── README.md
```

## Installation

```bash
npm install
```

## Running in Development

### Electron Frontend
```bash
npm run dev
```

This command:
1. Starts the Vite dev server at `http://localhost:5173`
2. Waits for the dev server to be ready
3. Launches the Electron window pointing at that URL

### Backend Server
```bash
npm run server
```

Runs the standalone Express backend server:
- **Runtime**: Node.js
- **Framework**: Express
- **Default Port**: `3001`
- **Endpoints**:
  - `GET /health` — Service health check
  - `GET /api` — API information check
  - `POST /api/sessions` — Create a new assessment session
  - `GET /api/sessions/:sessionId` — Retrieve an existing session
  - `PATCH /api/sessions/:sessionId/end` — Mark a session as completed
  - All unknown routes return a JSON 404 response

### Session API Reference

#### 1. Create Session
- **Endpoint**: `POST /api/sessions`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "sessionId": "NA-A1B2C3"
  }
  ```
- **Response (HTTP 201 Created)**:
  ```json
  {
    "success": true,
    "session": {
      "sessionId": "NA-A1B2C3",
      "status": "active",
      "startedAt": "2026-10-21T06:29:55.647Z",
      "endedAt": null
    }
  }
  ```
- **Error Response (HTTP 409 Conflict)**:
  ```json
  {
    "success": false,
    "error": "Session with ID 'NA-A1B2C3' already exists"
  }
  ```

#### 2. Get Session
- **Endpoint**: `GET /api/sessions/:sessionId`
- **Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "session": {
      "sessionId": "NA-A1B2C3",
      "status": "active",
      "startedAt": "2026-10-21T06:29:55.647Z",
      "endedAt": null
    }
  }
  ```
- **Error Response (HTTP 404 Not Found)**:
  ```json
  {
    "success": false,
    "error": "Session not found"
  }
  ```

#### 3. End Session
- **Endpoint**: `PATCH /api/sessions/:sessionId/end`
- **Response (HTTP 200 OK)**:
  ```json
  {
    "success": true,
    "session": {
      "sessionId": "NA-A1B2C3",
      "status": "completed",
      "startedAt": "2026-10-21T06:29:55.647Z",
      "endedAt": "2026-10-21T06:30:15.123Z"
    }
  }
  ```

### Screenshot Upload API Reference (Commit 15)

Screenshots captured during an active assessment are received and stored locally on the backend per session under `backend/uploads/screenshots/<sessionId>/`. Frontend automatic upload integration will be added in a later commit.

#### 1. Upload Screenshot
- **Endpoint**: `POST /api/sessions/:sessionId/screenshots`
- **Content-Type**: `multipart/form-data`
- **Field Name**: `screenshot` (file, JPEG only)
- **Constraints**:
  - Validates `sessionId` against active in-memory session store (returns `404` if not found).
  - Strictly requires `image/jpeg` format (returns `400` for other MIME types).
  - Maximum file size: `2 MB` (returns `413 Payload Too Large` if exceeded).
  - Generates safe sequential filenames (e.g. `screenshot-000001.jpg`).
- **Response (HTTP 201 Created)**:
  ```json
  {
    "success": true,
    "screenshot": {
      "id": 1,
      "sessionId": "NA-A1B2C3",
      "filename": "screenshot-000001.jpg",
      "timestamp": "2026-10-23T18:00:00.000Z",
      "size": 145231,
      "mimeType": "image/jpeg"
    }
  }
  ```

#### 2. Get Screenshots Metadata
- **Endpoint**: `GET /api/sessions/:sessionId/screenshots`
- **Response (HTTP 200 OK)**:
  ```json
  {
    "sessionId": "NA-A1B2C3",
    "count": 3,
    "screenshots": [
      {
        "id": 1,
        "filename": "screenshot-000001.jpg",
        "timestamp": "2026-10-23T18:00:00.000Z",
        "size": 145231,
        "mimeType": "image/jpeg"
      }
    ]
  }
  ```

#### 3. Get Screenshot Statistics
- **Endpoint**: `GET /api/sessions/:sessionId/screenshots/stats`
- **Response (HTTP 200 OK)**:
  ```json
  {
    "sessionId": "NA-A1B2C3",
    "count": 120,
    "totalBytes": 15432123
  }
  ```

### Frontend → Backend Communication

When the user starts the assessment in the Electron app, the frontend synchronizes the session with the backend API:

```
Frontend (React/Electron)
    ↓
POST /api/sessions  { "sessionId": "NA-XXXXXX" }
    ↓
Express Backend (port 3001)
    ↓
Session created in memory & returned
    ↓
Frontend marks session active & starts timer
```

When the user finishes the test:
```
Frontend (React/Electron)
    ↓
PATCH /api/sessions/:sessionId/end
    ↓
Express Backend
    ↓
Session marked completed & endedAt recorded
    ↓
Frontend cleans up camera, screen, & timer
```

### Active Assessment Backend Monitoring (Commit 11)

While an assessment is actively running (`flow === 'in-progress'`), the frontend continuously monitors server connectivity and session state:

1. **Initial Connection Check**:
   - As soon as the assessment screen opens, a non-blocking background connection check is performed.
   - Shows `Backend: Checking...` while the check is in flight.
   - Transitions to `Backend: Connected` once verified, or `Backend: Disconnected` if unreachable.

2. **Periodic Session Check (Every 10 Seconds)**:
   - Polls `GET /api/sessions/:sessionId` every 10 seconds.
   - Updates the **Last server check** timestamp (e.g. `Last server check: 22:15:32`).
   - If `status: "active"` is returned, the local assessment continues normally.
   - If `status: "completed"` is returned (e.g. terminated remotely by an administrator), the local assessment safely and cleanly ends (stops timers, releases media streams, resets state).

3. **Connection Failure Resilience**:
   - If the backend is unreachable during a check, the app **does not crash** and **does not abruptly end** the assessment.
   - The indicator switches to `Backend: Disconnected` and displays a warning banner: *"Connection to the assessment server was lost. Retrying..."*.
   - A **Retry Connection** button allows manual immediate re-checking via `getBackendHealth()`.
   - The 10-second periodic poll automatically recovers once the backend is reachable again.

4. **Interval Cleanup & Leak Prevention**:
   - The 10-second timer is strictly tied to the active assessment lifecycle and cleaned up when:
     - The assessment ends (locally or remotely)
     - The component unmounts
     - The `sessionId` changes
   - Prevents duplicate intervals or lingering network requests when navigating between screens.

## Screenshot Monitoring

During an active assessment session, the application automatically captures the candidate's screen to verify testing integrity:

- **1-Second Capture Cadence**: The application captures the user's explicitly selected screen-sharing stream (`getDisplayMedia()`) once every second (1000 milliseconds) throughout the active assessment session.
- **Strict Privacy Guarantees**:
  - Only the user's explicitly selected screen-sharing `MediaStream` is captured.
  - Camera streams and unshared screens/windows are never captured.
  - No background or hidden screen capture is performed without user consent.
  - Does not call `getDisplayMedia()` again or alter the existing screen track.
  - Screen capture halts immediately if screen sharing is stopped by the candidate or system.
  - Screen capture stops completely when the assessment ends or when navigating away.
- **Overlap Prevention**: If a capture operation takes longer than 1000 milliseconds (e.g. under heavy system load), concurrent captures are prevented from piling up; subsequent cycles continue normally once the active capture finishes.
- **Local Testing & Memory Management**:
  - Screenshots are currently kept locally in memory for testing and real-time preview.
  - The UI maintains a real-time monitor displaying status (`Active`), capture rate (`1 screenshot / second`), total screenshots captured, last capture timestamp, and a live preview.
  - Previous object URLs are revoked upon each new frame and on teardown, preventing memory leaks and avoiding permanent disk storage.
  - Backend screenshot upload and storage will be implemented in a later commit.

### Screenshot Upload Flow

```
Screen sharing
↓
Screenshot captured every 1 second
↓
JPEG compression
↓
POST /api/sessions/:sessionId/screenshots
↓
Backend stores screenshot locally
```

- **Cadence & Execution**: Every ~1 second while the assessment is active and screen sharing is active, the captured JPEG Blob is uploaded as `multipart/form-data` to `POST /api/sessions/:sessionId/screenshots`.
- **Upload Guard**: Overlapping upload attempts are guarded against so that slow network connections do not spawn unlimited concurrent uploads.
- **Resilience to Failure**: Upload failures (network disconnection, server reboot, temporary HTTP errors) currently do not stop or invalidate the active assessment. The frontend records the failed upload count, flags the upload status (e.g. `Upload Status: Backend unavailable`), and continues capturing and attempting subsequent uploads without crashing.
- **Teardown**: When the assessment ends or screen sharing ends, capture and upload cease immediately.

### Screenshot Scheduler Reliability

- **Fixed 1-Second Capture Interval**: The scheduler executes on a strict 1000 millisecond cadence.
- **Single Scheduler Guarantee**: `startScreenshotCapture()` prevents duplicate interval loops or duplicate streams when re-rendered or invoked multiple times.
- **Controlled Concurrency**: Only one screenshot upload runs at any given time.
- **Slow Network & Memory Protection**: If an upload is in progress when the next screenshot frame is captured, the application maintains at most one pending screenshot. Any newer frame replaces an older pending screenshot, strictly preventing memory growth or unbounded network request queues.
- **Sequence Tracking**: Each successfully captured screenshot receives a strictly increasing sequence number (`sequence: 1, 2, 3...`) which is preserved through network errors and reset only when a brand new assessment session starts.
- **Clean Teardown**: Screenshot capture and uploads halt immediately when the assessment ends (`End Test`) or when the candidate stops screen sharing (`Status: Screen sharing stopped`). All timers, pending buffers, and preview URLs are cleaned up.

## Building for Production

```bash
npm run electron:build
```

Outputs a distributable to `dist-electron/`.

## Security

- `contextIsolation: true` — renderer and Node.js contexts are isolated
- `nodeIntegration: false` — the renderer cannot access Node.js APIs directly
- All IPC channels are exposed exclusively through `electron/preload.js`
- Express CORS enabled to allow secure API requests from the frontend

