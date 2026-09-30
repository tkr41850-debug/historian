import type { HistorianCommit } from "../types";
import { linePath } from "../parse";

const W = 640;
const H = 220;
const PAD = 36;

function series(commits: HistorianCommit[], key: "verbosity" | "erosion"): number[] {
  return commits.map((c) => c.commit[key]);
}

function path(xs: number[], ys: number[], max: number): string {
  return linePath(xs, ys, max, W, H, PAD);
}

export default function TrajectoryChart({
  commits,
  selected,
  onSelect,
}: {
  commits: HistorianCommit[];
  selected: string | null;
  onSelect: (sha: string) => void;
}) {
  if (commits.length === 0) return <p>No commits to chart.</p>;
  const vs = series(commits, "verbosity");
  const es = series(commits, "erosion");
  const max = Math.max(...vs, ...es, 1e-9) * 1.1;
  const X = (i: number) => PAD + (i / Math.max(commits.length - 1, 1)) * (W - 2 * PAD);
  const Y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="verbosity/erosion trajectory">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={PAD} x2={W - PAD} y1={H - PAD - t * (H - 2 * PAD)} y2={H - PAD - t * (H - 2 * PAD)} stroke="#ddd" />
          <text x={2} y={H - PAD - t * (H - 2 * PAD) + 4} fontSize={10} fill="#666">
            {(max * t).toFixed(3)}
          </text>
        </g>
      ))}
      <path d={path(commits.map((_, i) => i), vs, max)} fill="none" stroke="#4f8cff" strokeWidth={2} />
      <path d={path(commits.map((_, i) => i), es, max)} fill="none" stroke="#e06565" strokeWidth={2} strokeDasharray="6 3" />
      {commits.map((c, i) => (
        <circle
          key={`${c.sha}#${i}`}
          cx={X(i)}
          cy={Y(c.commit.verbosity)}
          r={c.sha === selected ? 6 : 3.5}
          fill={c.sha === selected ? "#123" : "#4f8cff"}
          style={{ cursor: "pointer" }}
          onClick={() => onSelect(c.sha)}
        >
          <title>{`${c.sha.slice(0, 8)} ${c.subject} (V=${c.commit.verbosity.toFixed(4)} E=${c.commit.erosion.toFixed(4)})`}</title>
        </circle>
      ))}
      {commits.map((c, i) => (
        <circle
          key={`e${c.sha}#${i}`}
          cx={X(i)}
          cy={Y(c.commit.erosion)}
          r={c.sha === selected ? 5 : 2.5}
          fill="none"
          stroke="#e06565"
          strokeWidth={1.5}
          style={{ cursor: "pointer" }}
          onClick={() => onSelect(c.sha)}
        >
          <title>{`${c.sha.slice(0, 8)} ${c.subject} (E=${c.commit.erosion.toFixed(4)} V=${c.commit.verbosity.toFixed(4)})`}</title>
        </circle>
      ))}
      <g fontSize={12}>
        <circle cx={W - 190} cy={14} r={4} fill="#4f8cff" />
        <text x={W - 182} y={18}>verbosity</text>
        <circle cx={W - 100} cy={14} r={4} fill="#e06565" />
        <text x={W - 92} y={18}>erosion</text>
      </g>
    </svg>
  );
}
