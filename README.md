# ChatVerse Simulator

A standalone, deployable frontend for **ChatVerse** — a real-time WebSocket-powered group chat application built with React + TypeScript + Vite.

## Features

- **Live WebSocket Chat** — Create or join rooms with 4-letter codes using PieSocket relay
- **Image Sharing** — Upload and share images (up to 2MB) directly in chat
- **Member Tracking** — Real-time presence detection with join/leave notifications
- **Export Conversations** — Download full chat logs as `.txt` files
- **Cyberpunk UI** — Premium dark theme with neon accents, glassmorphism, and smooth animations

## Tech Stack

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 4
- Lucide React Icons
- PieSocket WebSocket Relay

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Related

- [ChatVerse Backend](https://github.com/KunnalDayaRoy/ChatVerse) — Flask-SocketIO server with room management and message routing
