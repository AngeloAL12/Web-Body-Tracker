import type { ArmStats } from "../hooks/useHolistic";

interface StatsPanelProps {
  stats: ArmStats;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  const fmt = (v: number | null, decimals = 1): string =>
    v !== null ? v.toFixed(decimals) : "---";

  return (
    <div className="stats-panel">
      <h3>Brazo Derecho</h3>
      <div className="stat-row">
        <span className="stat-label">FPS</span>
        <span className="stat-value">{fmt(stats.fps)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Codo</span>
        <span className="stat-value">{fmt(stats.elbowAngle)}°</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Hombro</span>
        <span className="stat-value">{fmt(stats.shoulderElevation)}°</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Pinza</span>
        <span
          className="stat-value pincer"
          data-state={stats.pincerState ?? "null"}
        >
          {stats.pincerState ?? "---"}
        </span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Dist.</span>
        <span className="stat-value">{fmt(stats.pincerDistance, 3)}</span>
      </div>
    </div>
  );
}
