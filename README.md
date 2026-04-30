# Brazo Tracker

Real-time right arm tracking using webcam + MediaPipe Holistic. Measures elbow angle, shoulder elevation, and pincer grip state — overlaid live on the video feed.

## What it tracks

| Metric | Description |
|--------|-------------|
| **Codo** | Elbow flexion angle (shoulder–elbow–wrist) |
| **Hombro** | Shoulder elevation angle (hip–shoulder–elbow) |
| **Pinza** | Pincer grip state: `Abierta` / `Cerrada` |
| **Dist.** | Thumb-tip to index-tip distance (normalized) |

## Stack

- React 19 + TypeScript
- MediaPipe Holistic (pose + hand landmarks)
- Vite

## Setup

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173` and allow webcam access. Model loads from CDN on first run.

## Build

```bash
pnpm build
pnpm preview
```

## Architecture

```
src/
├── hooks/useHolistic.ts      # MediaPipe init, camera loop, landmark math
├── components/ArmTracker.tsx # Video + canvas overlay + stats panel
├── components/StatsPanel.tsx # Angle/grip display
└── utils/angles.ts           # calcAngle (3D dot product) + landmarkDistance
```

MediaPipe model runs at 1280×720. Pose landmarks use right-side indices (shoulder 12, elbow 14, wrist 16, hip 24). Pincer closes when thumb–index distance < 0.08 (normalized coords).
