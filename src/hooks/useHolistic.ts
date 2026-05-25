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
  pincerDistance: number | null;
  pincerState: "Cerrada" | "Abierta" | null;
  fps: number | null;
  ready: boolean;
  rawShoulder: { x: number; y: number; z: number } | null;
  rawElbow: { x: number; y: number; z: number } | null;
  rightFist: boolean;  // true when right hand is making a fist
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
    fps: null,
    ready: false,
    rawShoulder: null,
    rawElbow: null,
    rightFist: false,
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

      // Fist: all fingertips curled (tip.y > pip.y in normalized coords, since y grows downward)
      const TIPS = [8, 12, 16, 20];
      const PIPS = [6, 10, 14, 18];
      const rh = results.rightHandLandmarks;
      const rightFist = rh != null && rh.length > 0
        && TIPS.every((tip, i) => rh[tip] && rh[PIPS[i]] && rh[tip].y > rh[PIPS[i]].y);

      setStats({
        elbowAngle,
        shoulderElevation,
        pincerDistance,
        pincerState,
        fps: Math.max(0, Number(smoothFps.toFixed(1))),
        ready: true,
        rawShoulder: rawShoulder ? { x: rawShoulder.x, y: rawShoulder.y, z: rawShoulder.z } : null,
        rawElbow: rawElbow ? { x: rawElbow.x, y: rawElbow.y, z: rawElbow.z } : null,
        rightFist,
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
