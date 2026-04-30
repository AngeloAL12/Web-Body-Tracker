// MediaPipe global declarations — loaded via CDN <script> tags, not bundled

interface MPLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

type MPLandmarkList = MPLandmark[]

interface MPHolisticResults {
  poseLandmarks: MPLandmarkList | undefined
  rightHandLandmarks: MPLandmarkList | undefined
  leftHandLandmarks: MPLandmarkList | undefined
  image: HTMLCanvasElement
}

interface MPHolisticOptions {
  modelComplexity?: 0 | 1 | 2
  smoothLandmarks?: boolean
  enableSegmentation?: boolean
  smoothSegmentation?: boolean
  refineFaceLandmarks?: boolean
  minDetectionConfidence?: number
  minTrackingConfidence?: number
}

interface MPDrawingOptions {
  color?: string
  lineWidth?: number
  radius?: number
  visibilityMin?: number
}

declare class Holistic {
  constructor(config?: { locateFile?: (file: string) => string })
  setOptions(options: MPHolisticOptions): void
  onResults(callback: (results: MPHolisticResults) => void): void
  send(inputs: { image: HTMLVideoElement }): Promise<void>
  close(): Promise<void>
}

declare class Camera {
  constructor(
    video: HTMLVideoElement,
    options: {
      onFrame: () => Promise<void>
      width?: number
      height?: number
      facingMode?: string
    },
  )
  start(): Promise<void>
  stop(): Promise<void>
}

declare function drawConnectors(
  ctx: CanvasRenderingContext2D,
  landmarks: MPLandmarkList | undefined,
  connections: Array<[number, number]>,
  options?: MPDrawingOptions,
): void

declare function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: MPLandmarkList | undefined,
  options?: MPDrawingOptions,
): void

declare const POSE_CONNECTIONS: Array<[number, number]>
declare const HAND_CONNECTIONS: Array<[number, number]>
