# Newton Athena

A desktop application for monitored online assessments, built with Electron, React, and Vite.

## Technologies

| Layer        | Technology              |
|-------------|-------------------------|
| Desktop      | Electron 33             |
| UI Framework | React 18                |
| Build Tool   | Vite 6                  |
| Language     | JavaScript (ES Modules) |
| Runtime      | Node.js / npm           |
| Styling      | Vanilla CSS             |

## Project Structure

```
Newton_Athena/
├── electron/
│   ├── main.js        # Electron main process
│   └── preload.js     # Context bridge (secure IPC scaffold)
├── src/
│   ├── main.jsx       # React entry point
│   ├── App.jsx        # Homepage component
│   ├── App.css        # Homepage styles
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

```bash
npm run dev
```

This command:
1. Starts the Vite dev server at `http://localhost:5173`
2. Waits for the dev server to be ready
3. Launches the Electron window pointing at that URL

## Building for Production

```bash
npm run electron:build
```

Outputs a distributable to `dist-electron/`.

## Security

- `contextIsolation: true` — renderer and Node.js contexts are isolated
- `nodeIntegration: false` — the renderer cannot access Node.js APIs directly
- All future IPC channels will be exposed exclusively through `electron/preload.js`

---

> **Commit 1 of 30** — Project foundation only. Camera, screen monitoring, authentication, and backend will be added in subsequent commits.
