import { useEffect, useRef, useState } from "react";
import { useHolistic } from "../hooks/useHolistic";
import { useSerial } from "../hooks/useSerial";
import { mapToServos, formatFrame } from "../utils/servoMapping";
import type { ServoValues } from "../utils/servoMapping";
import { StatsPanel } from "./StatsPanel";
import { SerialControl } from "./SerialControl";

const ALPHA = 0.4;
const ALPHA_BASE = 0.15;
const BASE_DEADBAND = 3;
const LS_DEADBAND = 20;
const PINCH_HOLD_MS = 700;
const BASE_MAX_JUMP = 60;

export function ArmTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothRef = useRef<ServoValues | null>(null);
  const [gripLocked, setGripLocked] = useState(false);
  const [pinchProgress, setPinchProgress] = useState(0); // 0–1
  const [lockFlash, setLockFlash] = useState(false);
  const [lockedBase, setLockedBase] = useState<number>(90);
  const baseDirectionRef = useRef<1 | -1>(1);
  const baseRafRef = useRef<number | null>(null);
  const lastBaseTimeRef = useRef<number | null>(null);

  const pinchStartRef = useRef<number | null>(null);
  const lockCooldownRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [gestureCountdown, setGestureCountdown] = useState<number | null>(null);
  const gestureStartRef = useRef<number | null>(null);
  const gestureRafRef = useRef<number | null>(null);
  const gestureFiredRef = useRef(false);

  const stats = useHolistic(videoRef, canvasRef);
  const serial = useSerial(50);

  const GESTURE_HOLD_MS = 3000;

  useEffect(() => {
    const canConnect = serial.status.kind === "disconnected" || serial.status.kind === "error";
    if (!canConnect) {
      if (gestureRafRef.current !== null) cancelAnimationFrame(gestureRafRef.current);
      gestureRafRef.current = null;
      gestureStartRef.current = null;
      gestureFiredRef.current = false;
      setGestureCountdown(null);
      return;
    }

    if (stats.bothHandsOpen && !gestureFiredRef.current) {
      if (gestureStartRef.current === null) {
        gestureStartRef.current = performance.now();
      }

      const tick = () => {
        if (gestureStartRef.current === null) return;
        const elapsed = performance.now() - gestureStartRef.current;
        const remaining = Math.ceil((GESTURE_HOLD_MS - elapsed) / 1000);
        setGestureCountdown(Math.max(remaining, 1));

        if (elapsed >= GESTURE_HOLD_MS) {
          gestureFiredRef.current = true;
          setGestureCountdown(null);
          void serial.connect();
        } else {
          gestureRafRef.current = requestAnimationFrame(tick);
        }
      };

      if (gestureRafRef.current === null) {
        gestureRafRef.current = requestAnimationFrame(tick);
      }
    } else if (!stats.bothHandsOpen) {
      if (gestureRafRef.current !== null) cancelAnimationFrame(gestureRafRef.current);
      gestureRafRef.current = null;
      gestureStartRef.current = null;
      gestureFiredRef.current = false;
      setGestureCountdown(null);
    }
  }, [stats.bothHandsOpen, serial]);

  // Animate progress bar while peace sign is held
  useEffect(() => {
    const fisting = stats.rightPeaceSign;

    if (fisting && !lockCooldownRef.current) {
      if (pinchStartRef.current === null) {
        pinchStartRef.current = performance.now();
      }

      const tick = () => {
        if (pinchStartRef.current === null) return;
        const elapsed = performance.now() - pinchStartRef.current;
        const progress = Math.min(elapsed / PINCH_HOLD_MS, 1);
        setPinchProgress(progress);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else if (!lockCooldownRef.current) {
          lockCooldownRef.current = true;
          setGripLocked((prev) => !prev);
          setLockFlash(true);
          setTimeout(() => setLockFlash(false), 400);
        }
      };

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pinchStartRef.current = null;
      if (!fisting) lockCooldownRef.current = false;
      setPinchProgress(0);
    }
  }, [stats.rightPeaceSign]);

  const BASE_SPEED = 45; // degrees per second

  useEffect(() => {
    if (stats.rightFist) {
      lastBaseTimeRef.current = performance.now();

      const tick = () => {
        const now = performance.now();
        const dt = (now - (lastBaseTimeRef.current ?? now)) / 1000;
        lastBaseTimeRef.current = now;

        setLockedBase((prev) => {
          let next = prev + baseDirectionRef.current * BASE_SPEED * dt;
          if (next >= 180) { next = 180; baseDirectionRef.current = -1; }
          if (next <= 0) { next = 0; baseDirectionRef.current = 1; }
          return next;
        });

        baseRafRef.current = requestAnimationFrame(tick);
      };

      baseRafRef.current = requestAnimationFrame(tick);
      return () => {
        if (baseRafRef.current !== null) cancelAnimationFrame(baseRafRef.current);
        baseRafRef.current = null;
      };
    } else {
      if (baseRafRef.current !== null) cancelAnimationFrame(baseRafRef.current);
      baseRafRef.current = null;
      lastBaseTimeRef.current = null;
    }
  }, [stats.rightFist]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (serial.status.kind !== "connected") return;
    const raw = mapToServos(stats);
    const prev = smoothRef.current ?? raw;

    const newLs = prev.ls + ALPHA * (raw.ls - prev.ls);
    const ls = gripLocked
      ? prev.ls
      : Math.abs(raw.ls - prev.ls) > LS_DEADBAND
        ? newLs
        : prev.ls;

    const targetBase = lockedBase;

    const smoothed: ServoValues = {
      base: prev.base + ALPHA_BASE * (targetBase - prev.base),
      j1: prev.j1 + ALPHA * (raw.j1 - prev.j1),
      j2: prev.j2 + ALPHA * (raw.j2 - prev.j2),
      j3: prev.j3 + ALPHA * (raw.j3 - prev.j3),
      ts: prev.ts + ALPHA * (raw.ts - prev.ts),
      ls,
    };
    smoothRef.current = smoothed;
    serial.sendFrame(formatFrame(smoothed));
  }, [stats, serial, gripLocked]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        (e.key === "q" || e.key === "Q") &&
        serial.status.kind === "connected"
      ) {
        void serial.disconnect();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [serial]);

  return (
    <div className="tracker-container">
      <video
        ref={videoRef}
        className="tracker-video"
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="tracker-canvas" />
      {!stats.ready && (
        <div className="loading-overlay">
          <span>Cargando modelo...</span>
        </div>
      )}
      {gestureCountdown !== null && (
        <div className="gesture-countdown">
          <span className="gesture-countdown__number">{gestureCountdown}</span>
          <span className="gesture-countdown__label">Conectando...</span>
        </div>
      )}
      <StatsPanel stats={stats} lockedBase={lockedBase} />
      <SerialControl
        status={serial.status}
        onConnect={serial.connect}
        onDisconnect={serial.disconnect}
        gripLocked={gripLocked}
        pinchProgress={pinchProgress}
        lockFlash={lockFlash}
      />
    </div>
  );
}
