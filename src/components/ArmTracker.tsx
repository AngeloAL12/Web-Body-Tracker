import { useRef } from 'react'
import { useHolistic } from '../hooks/useHolistic'
import { StatsPanel } from './StatsPanel'

export function ArmTracker() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const stats = useHolistic(videoRef, canvasRef)

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
    </div>
  )
}
