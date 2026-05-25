import type { SerialStatus } from "../hooks/useSerial";

interface SerialControlProps {
  status: SerialStatus;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  gripLocked: boolean;
  pinchProgress: number;  // 0–1
  lockFlash: boolean;
}

export function SerialControl({ status, onConnect, onDisconnect, gripLocked, pinchProgress, lockFlash }: SerialControlProps) {
  return (
    <div className="serial-control">
      <div className={`serial-status serial-status--${status.kind}`}>
        <span className="serial-status__dot" />
        <span className="serial-status__message">
          {status.kind === "unavailable" && "Web Serial no disponible (usa Chrome/Edge)"}
          {status.kind === "disconnected" && "Desconectado"}
          {status.kind === "connecting" && "Conectando..."}
          {status.kind === "countdown" && `Conectando en ${status.seconds}...`}
          {status.kind === "connected" && "Puerto conectado"}
          {status.kind === "error" && status.message}
        </span>
      </div>

      {status.kind === "connected" && (
        <>
          <div className={`grip-lock-status ${gripLocked ? "grip-lock-status--locked" : ""} ${lockFlash ? "grip-lock-status--flash" : ""}`}>
            <span className="grip-lock-status__dot" />
            <span>{gripLocked ? "Pinza bloqueada" : "Pinza libre"}</span>
          </div>

          {pinchProgress > 0 && (
            <div className="pinch-progress">
              <div
                className="pinch-progress__bar"
                style={{ width: `${pinchProgress * 100}%` }}
              />
            </div>
          )}
        </>
      )}

      {status.kind === "disconnected" && (
        <button className="serial-btn serial-btn--connect" onClick={onConnect}>
          Conectar
        </button>
      )}
      {status.kind === "connecting" && (
        <button className="serial-btn serial-btn--connect" disabled>
          Conectando...
        </button>
      )}
      {status.kind === "countdown" && (
        <button className="serial-btn serial-btn--connect" disabled>
          Conectando en {status.seconds}...
        </button>
      )}
      {status.kind === "connected" && (
        <button className="serial-btn serial-btn--disconnect" onClick={onDisconnect}>
          Desconectar <span className="serial-btn__hint">[Q]</span>
        </button>
      )}
      {status.kind === "error" && (
        <button className="serial-btn serial-btn--connect" onClick={onConnect}>
          Reintentar
        </button>
      )}
    </div>
  );
}
