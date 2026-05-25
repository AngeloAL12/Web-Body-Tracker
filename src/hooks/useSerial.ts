import { useEffect, useRef, useState } from "react";

export type SerialStatus =
  | { kind: "unavailable" }
  | { kind: "disconnected" }
  | { kind: "connecting" }
  | { kind: "connected"; port: SerialPort }
  | { kind: "error"; message: string };

export interface SerialHook {
  status: SerialStatus;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendFrame: (frame: string) => void;
}

export function useSerial(intervalMs = 50): SerialHook {
  const [status, setStatus] = useState<SerialStatus>({ kind: "disconnected" });

  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef<string | null>(null);
  const writingRef = useRef(false);  // guard: skip tick if previous write still in flight
  const encoder = useRef(new TextEncoder());

  useEffect(() => {
    if (!("serial" in navigator)) {
      setStatus({ kind: "unavailable" });
    }
  }, []);

  async function handleDisconnect() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try { writerRef.current?.releaseLock(); } catch { /* ignore */ }
    writerRef.current = null;
    writingRef.current = false;
    setStatus({ kind: "disconnected" });
  }

  async function connect() {
    if (!("serial" in navigator)) {
      setStatus({ kind: "unavailable" });
      return;
    }
    setStatus({ kind: "connecting" });
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      const writer = port.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
      writerRef.current = writer;
      writingRef.current = false;
      setStatus({ kind: "connected", port });

      intervalRef.current = setInterval(() => {
        const frame = pendingRef.current;
        if (!frame || !writerRef.current || writingRef.current) return;
        pendingRef.current = null;
        writingRef.current = true;
        writerRef.current
          .write(encoder.current.encode(frame))
          .then(() => { writingRef.current = false; })
          .catch(() => void handleDisconnect());
      }, intervalMs);
    } catch (err) {
      const isDismissed =
        err instanceof DOMException && err.name === "NotFoundError";
      if (isDismissed) {
        setStatus({ kind: "disconnected" });
      } else {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setStatus({ kind: "error", message });
      }
    }
  }

  async function disconnect() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      writerRef.current?.releaseLock();
      writerRef.current = null;
      if (status.kind === "connected") {
        await status.port.close();
      }
    } catch { /* ignore */ }
    writingRef.current = false;
    setStatus({ kind: "disconnected" });
  }

  function sendFrame(frame: string) {
    pendingRef.current = frame;
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      try { writerRef.current?.releaseLock(); } catch { /* ignore */ }
    };
  }, []);

  return { status, connect, disconnect, sendFrame };
}
