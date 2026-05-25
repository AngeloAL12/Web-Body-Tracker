import type { ArmStats } from "../hooks/useHolistic";

export interface ServoValues {
  base: number; // 0–180
  j1: number; // 0–180
  j2: number; // 0–180
  j3: number; // 0–180
  ts: number; // 0–180
  ls: number; // 1500–2500
}

const LS_CLOSED = 2450; // hard cap — leaves mechanical slack before 2500µs physical limit
const LS_OPEN = 1500;

// Thumb-index distance range observed in practice
const PINCER_DIST_MIN = 0.008; // fully closed (measured)
const PINCER_DIST_MAX = 0.08; // fully open (measured)

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function mapToServos(stats: ArmStats): ServoValues {
  // BASE: horizontal rotation from shoulder→elbow vector in the x/z plane.
  // MediaPipe z increases toward the camera, so negate it for depth axis.
  // Z_SCALE amplifies the depth axis — MediaPipe z is much smaller in magnitude
  // than x, so without scaling, backward arm movement barely changes the base angle.
  // Result: arm fully forward → 90°, arm fully back → 0° or 180°.
  // Use normalized z component of shoulder→wrist unit vector.
  // Normalizing removes dependency on arm elevation — lowering arm no longer shifts base.
  // normZ range: ~-0.7 (fully forward) to ~+0.4 (fully back).
  const NZ_FORWARD = -0.99; // arm fully toward camera
  const NZ_BACK = 0.65;    // arm fully behind body
  let base = 90;
  const tip = stats.rawWrist ?? stats.rawElbow;
  if (stats.rawShoulder && tip) {
    const vx = tip.x - stats.rawShoulder.x;
    const vy = tip.y - stats.rawShoulder.y;
    const vz = tip.z - stats.rawShoulder.z;
    const len = Math.hypot(vx, vy, vz);
    if (len > 0) {
      const normZ = vz / len;
      const t = clamp((normZ - NZ_FORWARD) / (NZ_BACK - NZ_FORWARD), 0, 1);
      base = (1 - t) * 180;
    }
  }

  const j1 = Math.round(clamp(stats.shoulderElevation ?? 90, 0, 180));
  const j2 = Math.round(clamp(stats.elbowAngle ?? 90, 0, 180));

  // Proportional: small distance = closed gripper (2500µs), large = open (1500µs)
  let ls: number;
  if (stats.pincerDistance !== null) {
    const t = clamp(
      (stats.pincerDistance - PINCER_DIST_MIN) /
        (PINCER_DIST_MAX - PINCER_DIST_MIN),
      0,
      1,
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
