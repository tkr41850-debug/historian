import type { MetricKey, OverlaySeries, RepoId, Selection, XMode } from "../types";
import { METRICS, xLabel, yMax } from "../parse";

const W = 640;
const PAD = 36;

export default function MetricChart({
  series,
  xMode,
  metric,
  height = 220,
  selection,
  onSelect,
}: {
  series: OverlaySeries[];
  xMode: XMode;
  metric: MetricKey;
  height?: number;
  selection: Selection | null;
  onSelect: (repoId: RepoId, sha: string) => void;
}) {
  const total = series.reduce((a, s) => a + s.points.length, 0);
  const label = METRICS.find((m) => m.key === metric)?.label ?? metric;
  if (total === 0) return <p>No commits to chart.</p>;
  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const lo = Math.min(...allX);
  const hi = Math.max(...allX);
  // pad guard: a zero-span domain (single commit, or one shared x)
  // still renders instead of dividing by zero
  const span = hi - lo || 1;
  // shared y-max across all repos so overlaid series stay comparable
  const max = yMax(series) * 1.1;
  // pad guard: keep a positive plot area even for compact heights
  const H = Math.max(height, 2 * PAD + 40);
  const X = (v: number) => PAD + ((v - lo) / span) * (W - 2 * PAD);
  const Y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${label} overlay`}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD} x2={W - PAD} y1={H - PAD - t * (H - 2 * PAD)} y2={H - PAD - t * (H - 2 * PAD)} stroke="#ddd" />
            <text x={2} y={H - PAD - t * (H - 2 * PAD) + 4} fontSize={10} fill="#666">
              {(max * t).toFixed(3)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <path
            key={s.repoId}
            d={s.points
              .map((p, i) => `${i === 0 ? "M" : "L"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`)
              .join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
          />
        ))}
        {series.flatMap((s) =>
          s.points.map((p, i) => {
            const isSel = selection?.repoId === s.repoId && selection?.sha === p.sha;
            return (
              <circle
                key={`${s.repoId}:${p.sha}#${i}`}
                cx={X(p.x)}
                cy={Y(p.y)}
                r={isSel ? 6 : 3.5}
                fill={isSel ? "#123" : s.color}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(s.repoId, p.sha)}
              >
                <title>{`${s.label} ${p.sha.slice(0, 8)} (${label}=${p.y.toFixed(4)})`}</title>
              </circle>
            );
          }),
        )}
        <text x={PAD} y={H - 4} fontSize={10} fill="#666">
          {xLabel(xMode)}
        </text>
      </svg>
      <figcaption style={{ fontSize: 12, color: "#666", display: "flex", gap: 10, flexWrap: "wrap" }}>
        {series.map((s) => (
          <span key={s.repoId}>
            <span style={{ color: s.color }}>●</span> {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
