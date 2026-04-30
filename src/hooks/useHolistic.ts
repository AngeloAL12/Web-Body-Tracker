import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { calcAngle, landmarkDistance } from '../utils/angles'

// Right-side pose landmark indices
const SHOULDER = 12
const ELBOW = 14
const WRIST = 16
const HIP = 24

// Hand landmark indices
const THUMB_TIP = 4
const INDEX_TIP = 8

const PINCER_THRESHOLD = 0.08

export interface ArmStats {
  elbowAngle: number | null
  shoulderElevation: number | null
  pincerDistance: number | null
  pincerState: 'Cerrada' | 'Abierta' | null
  ready: boolean
}

export function useHolistic(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): ArmStats {
  const [stats, setStats] = useState<ArmStats>({
    elbowAngle: null,
    shoulderElevation: null,
    pincerDistance: null,
    pincerState: null,
    ready: false,
  })

  const cameraRef = useRef<Camera | null>(null)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const holistic = new Holistic({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    })

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      refineFaceLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    holistic.onResults((results: MPHolisticResults) => {
      if (video.videoWidth > 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }

      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: '#00FF00',
          lineWidth: 2,
        })
        drawLandmarks(ctx, results.poseLandmarks, {
          color: '#FF0000',
          lineWidth: 1,
          radius: 4,
        })
      }

      if (results.rightHandLandmarks) {
        drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, {
          color: '#00CCFF',
          lineWidth: 2,
        })
        drawLandmarks(ctx, results.rightHandLandmarks, {
          color: '#FFFF00',
          lineWidth: 1,
          radius: 3,
        })
      }

      ctx.restore()

      const pose = results.poseLandmarks
      let elbowAngle: number | null = null
      let shoulderElevation: number | null = null

      if (pose?.length) {
        const shoulder = pose[SHOULDER]
        const elbow = pose[ELBOW]
        const wrist = pose[WRIST]
        const hip = pose[HIP]

        if (shoulder && elbow && wrist) {
          elbowAngle = calcAngle(shoulder, elbow, wrist)
        }
        if (hip && shoulder && elbow) {
          shoulderElevation = calcAngle(hip, shoulder, elbow)
        }
      }

      const hand = results.rightHandLandmarks
      let pincerDistance: number | null = null
      let pincerState: 'Cerrada' | 'Abierta' | null = null

      if (hand?.length) {
        const thumbTip = hand[THUMB_TIP]
        const indexTip = hand[INDEX_TIP]
        if (thumbTip && indexTip) {
          pincerDistance = landmarkDistance(thumbTip, indexTip)
          pincerState = pincerDistance < PINCER_THRESHOLD ? 'Cerrada' : 'Abierta'
        }
      }

      setStats({ elbowAngle, shoulderElevation, pincerDistance, pincerState, ready: true })
    })

    const camera = new Camera(video, {
      onFrame: async () => {
        await holistic.send({ image: video })
      },
      width: 1280,
      height: 720,
    })

    cameraRef.current = camera
    camera.start()

    return () => {
      camera.stop()
      holistic.close()
      cameraRef.current = null
    }
  }, [videoRef, canvasRef])

  return stats
}
