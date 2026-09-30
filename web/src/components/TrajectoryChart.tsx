import type { HistorianCommit, RepoId, Selection, XMode } from "../types";
import { repoT0, xLabel, xValue } from "../parse";

const W = 640;
const H = 220;
const PAD = 36;

export interface TrajectoryRepo {
  commits: HistorianCommit[];
  color: string;
  label: string;
  repoId: RepoId;
}

interface Pt {
  x: number;
  v: number;
  e: number;
  sha: string;
  subject: string;
}

export default function TrajectoryChart({
  series,
  xMode,
  selected,
  onSelect,
}: {
  series: TrajectoryRepo[];
  xMode: XMode;
  selected: Selection | null;
  onSelect: (repoId: RepoId, sha: string) => void;
}) {
  const total = series.reduce((a, s) => a + s.commits.length, 0);
  if (total === 0) return <p>No commits to chart.</p>;
  const perRepo = series.map((r) => {
    const n = r.commits.length;
    const t0 = repoT0(r.commits);
    return {
      repo: r,
      pts: r.commits.map(
        (c, i): Pt => ({
          x: xValue(xMode, i, n, c.time, t0),
          v: c.commit.verbosity,
          e: c.commit.erosion,
          sha: c.sha,
          subject: c.subject,
        }),
      ),
    };
  });
  const allX = perRepo.flatMap((s) => s.pts.map((p) => p.x));
  const lo = Math.min(...allX);
  const hi = Math.max(...allX);
  const span = hi - lo || 1;
  const max = Math.max(1e-9, ...perRepo.flatMap((s) => s.pts.flatMap((p) => [p.v, p.e]))) * 1.1;
  const X = (v: number) => PAD + ((v - lo) / span) * (W - 2 * PAD);
  const Y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  const d = (pts: Pt[], pick: (p: Pt) => number) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.x).toFixed(1)},${Y(pick(p)).toFixed(1)}`).join(" ");
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="verbosity/erosion trajectory">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD} x2={W - PAD} y1={H - PAD - t * (H - 2 * PAD)} y2={H - PAD - t * (H - 2 * PAD)} stroke="#ddd" />
            <text x={2} y={H - PAD - t * (H - 2 * PAD) + 4} fontSize={10} fill="#666">
              {(max * t).toFixed(3)}
            </text>
          </g>
        ))}
        {perRepo.map(({ repo, pts }) =>
          pts.length === 0 ? null : (
            <g key={repo.repoId}>
              <path d={d(pts, (p) => p.v)} fill="none" stroke={repo.color} strokeWidth={2} />
              <path
                d={d(pts, (p) => p.e)}
                fill="none"
                stroke={repo.color}
                strokeWidth={2}
                strokeDasharray="6 3"
              />
            </g>
          ),
        )}
        {perRepo.flatMap(({ repo, pts }) =>
          pts.map((p, i) => {
            const isSel = selected?.repoId === repo.repoId && selected?.sha === p.sha;
            return (
              <circle
                key={`${repo.repoId}:${p.sha}#${i}`}
                cx={X(p.x)}
                cy={Y(p.v)}
                r={isSel ? 6 : 3.5}
                fill={isSel ? "#123" : repo.color}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(repo.repoId, p.sha)}
              >
                <title>{`${repo.label} ${p.sha.slice(0, 8)} ${p.subject} (V=${p.v.toFixed(4)} E=${p.e.toFixed(4)})`}</title>
              </circle>
            );
          }),
        )}
        {perRepo.flatMap(({ repo, pts }) =>
          pts.map((p, i) => {
            const isSel = selected?.repoId === repo.repoId && selected?.sha === p.sha;
            return (
              <circle
                key={`e:${repo.repoId}:${p.sha}#${i}`}
                cx={X(p.x)}
                cy={Y(p.e)}
                r={isSel ? 5 : 2.5}
                fill="none"
                stroke={repo.color}
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                onClick={() => onSelect(repo.repoId, p.sha)}
              >
                <title>{`${repo.label} ${p.sha.slice(0, 8)} ${p.subject} (E=${p.e.toFixed(4)} V=${p.v.toFixed(4)})`}</title>
              </circle>
            );
          }),
        )}
        <text x={PAD} y={H - 4} fontSize={10} fill="#666">
          {xLabel(xMode)}
        </text>
      </svg>
      <figcaption style={{ fontSize: 12, color: "#666", display: "flex", gap: 10, flexWrap: "wrap" }}>
        {series.map((r) => (
          <span key={r.repoId}>
            <span style={{ color: r.color }}>●</span> {r.label}
          </span>
        ))}
        <span>— verbosity (solid)</span>
        <span>- - erosion (dashed)</span>
      </figcaption>
    </figure>
  );
}
