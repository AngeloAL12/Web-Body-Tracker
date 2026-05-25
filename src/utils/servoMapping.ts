import type { ArmStats } from "../hooks/useHolistic";

export interface ServoValues {
  base: number; // 0–180
  j1: number;   // 0–180
  j2: number;   // 0–180
  j3: number;   // 0–180
  ts: number;   // 0–180
  ls: number;   // 1500–2500
}

const LS_CLOSED = 2150;  // hard cap — leaves mechanical slack before 2500µs physical limit
const LS_OPEN = 1500;

// Thumb-index distance range observed in practice
const PINCER_DIST_MIN = 0.02;  // fully closed fist
const PINCER_DIST_MAX = 0.10;  // fully open hand

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function mapToServos(stats: ArmStats): ServoValues {
  // BASE: horizontal rotation from shoulder→elbow vector in the x/z plane.
  // MediaPipe z increases toward the camera, so negate it for depth axis.
  // Result: -90° (arm behind) to +90° (arm in front), mapped to 0–180.
  let base = 90;
  if (stats.rawShoulder && stats.rawElbow) {
    const dx = stats.rawElbow.x - stats.rawShoulder.x;
    const dz = -(stats.rawElbow.z - stats.rawShoulder.z);
    const angleDeg = (Math.atan2(dx, dz) * 180) / Math.PI;
    base = Math.round(clamp(angleDeg + 90, 0, 180));
  }

  const j1 = Math.round(clamp(stats.shoulderElevation ?? 90, 0, 180));
  const j2 = Math.round(clamp(stats.elbowAngle ?? 90, 0, 180));
  // Proportional: small distance = closed gripper (2500µs), large = open (1500µs)
  let ls: number;
  if (stats.pincerDistance !== null) {
    const t = clamp(
      (stats.pincerDistance - PINCER_DIST_MIN) / (PINCER_DIST_MAX - PINCER_DIST_MIN),
      0,
      1
    );
    ls = Math.round(LS_CLOSED + t * (LS_OPEN - LS_CLOSED));
  } else {
    ls = LS_OPEN;
  }

  return { base, j1, j2, j3: 90, ts: 90, ls };
}

export function formatFrame(v: ServoValues): string {
  return `${v.base},${v.j1},${v.j2},${v.j3},${v.ts},${v.ls}\n`;
}
