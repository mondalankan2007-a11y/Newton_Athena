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
│   └── server.js      # Express API server (port 3001)
├── electron/
│   ├── main.js        # Electron main process
│   └── preload.js     # Context bridge (secure IPC)
├── src/
│   ├── main.jsx       # React entry point
│   ├── App.jsx        # Homepage & assessment flow component
│   ├── App.css        # Application styles
│   └── index.css      # Global styles / reset
├── index.html         # Vite HTML entry
├── vite.config.js     # Vite configuration
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

