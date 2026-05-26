import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { calcAngle, landmarkDistance } from "../utils/angles";

// Right-side pose landmark indices
const SHOULDER = 12;
const ELBOW = 14;
const WRIST = 16;
const HIP = 24;

// Hand landmark indices
const THUMB_TIP = 4;
const INDEX_TIP = 8;

const PINCER_THRESHOLD = 0.08;

export interface ArmStats {
  elbowAngle: number | null;
  shoulderElevation: number | null;
  wristAngle: number | null;
  pincerDistance: number | null;
  pincerState: "Cerrada" | "Abierta" | null;
  fps: number | null;
  ready: boolean;
  rawShoulder: { x: number; y: number; z: number } | null;
  rawElbow: { x: number; y: number; z: number } | null;
  rawWrist: { x: number; y: number; z: number } | null;
  rightFist: boolean;
  rightPeaceSign: boolean;
  bothHandsOpen: boolean;
  baseAngle: number | null; // 0–180, 90 = arm center, left/right from shoulder→wrist X axis
}

export function useHolistic(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): ArmStats {
  const [stats, setStats] = useState<ArmStats>({
    elbowAngle: null,
    shoulderElevation: null,
    wristAngle: null,
    pincerDistance: null,
    pincerState: null,
    fps: null,
    ready: false,
    rawShoulder: null,
    rawElbow: null,
    rawWrist: null,
    rightFist: false,
    rightPeaceSign: false,
    bothHandsOpen: false,
    baseAngle: null,
  });

  const cameraRef = useRef<Camera | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const holistic = new Holistic({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      refineFaceLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    const lastResultTime = { current: 0 };
    let smoothFps = 0;
    const SMOOTH = 0.12;

    holistic.onResults((results: MPHolisticResults) => {
      const now = performance.now();
      if (lastResultTime.current > 0) {
        const inst = 1000 / (now - lastResultTime.current);
        smoothFps =
          smoothFps === 0 ? inst : smoothFps * (1 - SMOOTH) + inst * SMOOTH;
      }
      lastResultTime.current = now;
      if (video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 2,
        });
        drawLandmarks(ctx, results.poseLandmarks, {
          color: "#FF0000",
          lineWidth: 1,
          radius: 4,
        });
      }

      if (results.leftHandLandmarks) {
        drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, {
          color: "#00CCFF",
          lineWidth: 2,
        });
        drawLandmarks(ctx, results.leftHandLandmarks, {
          color: "#FFFF00",
          lineWidth: 1,
          radius: 3,
        });
      }

      if (results.rightHandLandmarks) {
        drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, {
          color: "#FF6600",
          lineWidth: 2,
        });
        drawLandmarks(ctx, results.rightHandLandmarks, {
          color: "#FF6600",
          lineWidth: 1,
          radius: 3,
        });
      }

      ctx.restore();

      const pose = results.poseLandmarks;
      let elbowAngle: number | null = null;
      let shoulderElevation: number | null = null;
      let wristAngle: number | null = null;

      if (pose?.length) {
        const shoulder = pose[SHOULDER];
        const elbow = pose[ELBOW];
        const wrist = pose[WRIST];
        const hip = pose[HIP];

        if (shoulder && elbow && wrist) {
          elbowAngle = calcAngle(shoulder, elbow, wrist);
        }
        if (hip && shoulder && elbow) {
          shoulderElevation = calcAngle(hip, shoulder, elbow);
        }

        // Wrist flex/extension: elbow → wrist → middle finger MCP (index 9 in right hand)
        const rh = results.rightHandLandmarks;
        if (elbow && wrist && rh?.length) {
          const middleMcp = rh[9];
          if (middleMcp) {
            wristAngle = calcAngle(elbow, wrist, middleMcp);
          }
        }
      }

      const hand = results.leftHandLandmarks;
      let pincerDistance: number | null = null;
      let pincerState: "Cerrada" | "Abierta" | null = null;

      if (hand?.length) {
        const thumbTip = hand[THUMB_TIP];
        const indexTip = hand[INDEX_TIP];
        if (thumbTip && indexTip) {
          pincerDistance = landmarkDistance(thumbTip, indexTip);
          pincerState =
            pincerDistance < PINCER_THRESHOLD ? "Cerrada" : "Abierta";
        }
      }

      const rawShoulder = pose?.[SHOULDER] ?? null;
      const rawElbow = pose?.[ELBOW] ?? null;
      const rawWrist = pose?.[WRIST] ?? null;

      // Fist: all fingertips curled (tip.y > pip.y in normalized coords, since y grows downward)
      const TIPS = [8, 12, 16, 20];
      const PIPS = [6, 10, 14, 18];
      const rh = results.rightHandLandmarks;
      const rightFist = rh != null && rh.length > 0
        && TIPS.every((tip, i) => rh[tip] && rh[PIPS[i]] && rh[tip].y > rh[PIPS[i]].y);

      // Peace sign: index (8) + middle (12) extended, ring (16) + pinky (20) curled
      const rightPeaceSign = rh != null && rh.length > 0
        && rh[8] && rh[6] && rh[8].y < rh[6].y     // index extended
        && rh[12] && rh[10] && rh[12].y < rh[10].y  // middle extended
        && rh[16] && rh[14] && rh[16].y > rh[14].y  // ring curled
        && rh[20] && rh[18] && rh[20].y > rh[18].y; // pinky curled

      // Open hand: all fingertips extended (tip.y < pip.y)
      const lh = results.leftHandLandmarks;
      const isHandOpen = (landmarks: typeof rh) =>
        landmarks != null && landmarks.length > 0
        && TIPS.every((tip, i) => landmarks[tip] && landmarks[PIPS[i]] && landmarks[tip].y < landmarks[PIPS[i]].y);
      const bothHandsOpen = isHandOpen(lh) && isHandOpen(rh);

      setStats({
        elbowAngle,
        shoulderElevation,
        wristAngle,
        pincerDistance,
        pincerState,
        fps: Math.max(0, Number(smoothFps.toFixed(1))),
        ready: true,
        rawShoulder: rawShoulder ? { x: rawShoulder.x, y: rawShoulder.y, z: rawShoulder.z } : null,
        rawElbow: rawElbow ? { x: rawElbow.x, y: rawElbow.y, z: rawElbow.z } : null,
        rawWrist: rawWrist ? { x: rawWrist.x, y: rawWrist.y, z: rawWrist.z } : null,
        rightFist,
        rightPeaceSign,
        bothHandsOpen,
        baseAngle: (() => {
          const tip = rawWrist ?? rawElbow;
          if (!rawShoulder || !tip) return null;
          const vx = tip.x - rawShoulder.x;
          const vy = tip.y - rawShoulder.y;
          // Use 2D (image-plane) length only — MediaPipe Z is noisy and washes out X
          const len2d = Math.hypot(vx, vy);
          if (len2d < 0.05) return null; // arm too close to shoulder, unreliable
          // normX: negative = arm to user's right (image left), positive = arm to user's left
          // negate vx to match mirrored video (scaleX(-1))
          const normX = -(vx / len2d);
          // map -1..+1 to 0..180
          return (normX + 1) * 90;
        })(),
      });
    });

    const camera = new Camera(video, {
      onFrame: async () => {
        await holistic.send({ image: video });
      },
      width: 1280,
      height: 720,
    });

    cameraRef.current = camera;
    camera.start();

    return () => {
      camera.stop();
      holistic.close();
      cameraRef.current = null;
    };
  }, [videoRef, canvasRef]);

  return stats;
}
