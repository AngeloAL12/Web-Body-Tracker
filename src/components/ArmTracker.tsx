import { useEffect, useRef, useState } from 'react'
import { useHolistic } from '../hooks/useHolistic'
import { useSerial } from '../hooks/useSerial'
import { mapToServos, formatFrame } from '../utils/servoMapping'
import type { ServoValues } from '../utils/servoMapping'
import { StatsPanel } from './StatsPanel'
import { SerialControl } from './SerialControl'

const ALPHA = 0.15
const LS_DEADBAND = 20
const PINCH_HOLD_MS = 700

export function ArmTracker() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const smoothRef = useRef<ServoValues | null>(null)
  const [gripLocked, setGripLocked] = useState(false)
  const [pinchProgress, setPinchProgress] = useState(0)  // 0–1
  const [lockFlash, setLockFlash] = useState(false)

  const pinchStartRef = useRef<number | null>(null)
  const lockCooldownRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  const stats = useHolistic(videoRef, canvasRef)
  const serial = useSerial(50)

  // Animate progress bar while right fist is held
  useEffect(() => {
    const fisting = stats.rightFist

    if (fisting && !lockCooldownRef.current) {
      if (pinchStartRef.current === null) {
        pinchStartRef.current = performance.now()
      }

      const tick = () => {
        if (pinchStartRef.current === null) return
        const elapsed = performance.now() - pinchStartRef.current
        const progress = Math.min(elapsed / PINCH_HOLD_MS, 1)
        setPinchProgress(progress)

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else if (!lockCooldownRef.current) {
          lockCooldownRef.current = true
          setGripLocked(prev => !prev)
          setLockFlash(true)
          setTimeout(() => setLockFlash(false), 400)
        }
      }

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick)
      }
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      pinchStartRef.current = null
      if (!fisting) lockCooldownRef.current = false
      setPinchProgress(0)
    }
  }, [stats.rightFist])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (serial.status.kind !== 'connected') return
    const raw = mapToServos(stats)
    const prev = smoothRef.current ?? raw

    const newLs = prev.ls + ALPHA * (raw.ls - prev.ls)
    const ls = gripLocked
      ? prev.ls
      : Math.abs(newLs - prev.ls) > LS_DEADBAND ? newLs : prev.ls

    const smoothed: ServoValues = {
      base: prev.base + ALPHA * (raw.base - prev.base),
      j1:   prev.j1   + ALPHA * (raw.j1   - prev.j1),
      j2:   prev.j2   + ALPHA * (raw.j2   - prev.j2),
      j3:   prev.j3   + ALPHA * (raw.j3   - prev.j3),
      ts:   prev.ts   + ALPHA * (raw.ts   - prev.ts),
      ls,
    }
    smoothRef.current = smoothed
    serial.sendFrame(formatFrame(smoothed))
  }, [stats, serial, gripLocked])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'q' || e.key === 'Q') && serial.status.kind === 'connected') {
        void serial.disconnect()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [serial])

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
      <StatsPanel stats={stats} />
      <SerialControl
        status={serial.status}
        onConnect={serial.connect}
        onDisconnect={serial.disconnect}
        gripLocked={gripLocked}
        pinchProgress={pinchProgress}
        lockFlash={lockFlash}
      />
    </div>
  )
}
