interface BaseGaugeProps {
  angle: number | null; // 0–180, 90 = center
}

const W = 200;
const H = 110;
const CX = W / 2;
const CY = H - 10;
const R = 85;
const TICK_COUNT = 7; // 0, 30, 60, 90, 120, 150, 180

function polarToXY(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX - r * Math.cos(rad),
    y: CY - r * Math.sin(rad),
  };
}

export function BaseGauge({ angle }: BaseGaugeProps) {
  const arcStart = polarToXY(0, R);
  const arcEnd = polarToXY(180, R);
  const arcPath = `M ${arcStart.x} ${arcStart.y} A ${R} ${R} 0 0 1 ${arcEnd.x} ${arcEnd.y}`;

  const needleAngle = angle ?? 90;
  const needle = polarToXY(needleAngle, R - 10);
  const needleBase1 = polarToXY(needleAngle + 90, 7);
  const needleBase2 = polarToXY(needleAngle - 90, 7);

  const isReady = angle !== null;

  return (
    <div className="base-gauge">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        {/* Arc track */}
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Colored arc up to current angle */}
        {isReady && (
          <path
            d={`M ${polarToXY(0, R).x} ${polarToXY(0, R).y} A ${R} ${R} 0 ${needleAngle > 90 ? 1 : 0} 1 ${polarToXY(needleAngle, R).x} ${polarToXY(needleAngle, R).y}`}
            fill="none"
            stroke={needleAngle < 70 ? "#60a5fa" : needleAngle > 110 ? "#f87171" : "#4ade80"}
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.7"
          />
        )}

        {/* Center mark at 90° */}
        {(() => {
          const inner = polarToXY(90, R - 14);
          const outer = polarToXY(90, R + 4);
          return (
            <line
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2"
            />
          );
        })()}

        {/* Tick marks */}
        {Array.from({ length: TICK_COUNT }, (_, i) => {
          const a = (i / (TICK_COUNT - 1)) * 180;
          const inner = polarToXY(a, R - 10);
          const outer = polarToXY(a, R + 2);
          return (
            <line
              key={i}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
            />
          );
        })}

        {/* Needle */}
        {isReady && (
          <polygon
            points={`${needle.x},${needle.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
            fill="#fff"
            opacity="0.9"
          />
        )}

        {/* Center pivot */}
        <circle cx={CX} cy={CY} r={5} fill={isReady ? "#fff" : "rgba(255,255,255,0.3)"} />

        {/* Labels */}
        <text x={8} y={H - 2} fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="ui-monospace,monospace">IZQ</text>
        <text x={W - 8} y={H - 2} fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="ui-monospace,monospace" textAnchor="end">DER</text>
      </svg>

      <div className="base-gauge__value">
        <span className="base-gauge__label">Base</span>
        <span className="base-gauge__number" style={{ color: isReady ? (needleAngle < 70 ? "#60a5fa" : needleAngle > 110 ? "#f87171" : "#4ade80") : "rgba(255,255,255,0.3)" }}>
          {isReady ? `${Math.round(needleAngle)}°` : "---"}
        </span>
      </div>
    </div>
  );
}
