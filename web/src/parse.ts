import type {
  HistorianCommit,
  HistorianData,
  MetricKey,
  OverlayPoint,
  OverlaySeries,
  RepoEntry,
  RepoId,
  Trajectory,
  XMode,
} from "./types";

/** Mirror of historian/formulas.py linear_fit: least-squares slope + intercept. */
export function linearFit(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: ys[0] };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (den === 0) return { slope: 0, intercept: my };
  const slope =
    xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den;
  return { slope, intercept: my - slope * mx };
}

/** Recompute trajectory from commit series (lets UI stay correct if filtered). */
export function trajectoryOf(commits: HistorianCommit[]): Trajectory {
  const vs = commits.map((c) => c.commit.verbosity);
  const es = commits.map((c) => c.commit.erosion);
  const xs = commits.map((_, i) => i);
  const bv = linearFit(xs, vs);
  const be = linearFit(xs, es);
  return {
    delta_v: vs.length ? vs[vs.length - 1] - vs[0] : 0,
    delta_e: es.length ? es[es.length - 1] - es[0] : 0,
    beta_v: bv.slope,
    beta_e: be.slope,
  };
}

/** Per-step velocity: first-difference of V/E/LOC between consecutive commits. */
export interface CommitVelocity {
  sha: string;
  dV: number;
  dE: number;
  dLoc: number;
}

export function velocities(commits: HistorianCommit[]): CommitVelocity[] {
  return commits.map((c, i) => ({
    sha: c.sha,
    dV: i === 0 ? 0 : c.commit.verbosity - commits[i - 1].commit.verbosity,
    dE: i === 0 ? 0 : c.commit.erosion - commits[i - 1].commit.erosion,
    dLoc: i === 0 ? 0 : c.commit.loc - commits[i - 1].commit.loc,
  }));
}

export type SortKey =
  | "index"
  | "sha"
  | "date"
  | "author"
  | "subject"
  | "verbosity"
  | "erosion"
  | "loc"
  | "cc_avg";

/**
 * Stable sort of commits. Ties always break by original commit order
 * (chronological index), never by sha or subject, so equal rows keep
 * their trajectory position regardless of sort direction.
 */
export function sortCommits(
  commits: HistorianCommit[],
  key: SortKey,
  dir: 1 | -1,
): HistorianCommit[] {
  if (key === "index") {
    const out = [...commits];
    return dir === 1 ? out : out.reverse();
  }
  const val = (c: HistorianCommit): string | number => {
    switch (key) {
      case "sha": return c.sha;
      case "date": return c.time;
      case "author": return c.author.toLowerCase();
      case "subject": return c.subject.toLowerCase();
      case "verbosity": return c.commit.verbosity;
      case "erosion": return c.commit.erosion;
      case "loc": return c.commit.loc;
      case "cc_avg": return c.commit.cc_avg;
    }
  };
  return commits
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const va = val(a.c);
      const vb = val(b.c);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      if (cmp !== 0) return cmp * dir;
      return a.i - b.i; // commit-order tiebreak (stable)
    })
    .map(({ c }) => c);
}

function num(v: unknown, what: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  throw new Error(`${what} must be a finite number`);
}

export function parseHistorian(raw: unknown): HistorianData {
  if (typeof raw !== "object" || raw === null) throw new Error("JSON must be an object");
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.commits)) throw new Error("JSON missing commits[] (run python -m historian --out historian.json)");
  const commits = (d.commits as unknown[]).map((rawC, i) => {
    if (typeof rawC !== "object" || rawC === null || Array.isArray(rawC))
      throw new Error(`commit[${i}] must be an object`);
    const c = rawC as Record<string, unknown>;
    if (typeof c.sha !== "string" || !c.sha) throw new Error(`commit[${i}] missing sha`);
    if (typeof c.time !== "number" || !Number.isFinite(c.time))
      throw new Error(`commit[${i}] (${String(c.sha).slice(0, 8)}) has non-numeric time`);
    const s = c.commit;
    if (typeof s !== "object" || s === null || Array.isArray(s))
      throw new Error(`commit[${i}] (${String(c.sha).slice(0, 8)}) missing commit summary`);
    const sm = s as Record<string, unknown>;
    const tag = `commit[${i}] (${String(c.sha).slice(0, 8)})`;
    const files = c.files;
    return {
      sha: c.sha,
      time: c.time,
      author: typeof c.author === "string" ? c.author : "?",
      email: typeof c.email === "string" ? c.email : "",
      subject: typeof c.subject === "string" ? c.subject : "",
      body: typeof c.body === "string" ? c.body : "",
      permalink: typeof c.permalink === "string" ? c.permalink : null,
      files: (typeof files === "object" && files !== null && !Array.isArray(files) ? files : {}) as HistorianCommit["files"],
      repo: (typeof c.repo === "object" && c.repo !== null ? c.repo : undefined) as HistorianCommit["repo"],
      commit: {
        loc: num(sm.loc, `${tag}.commit.loc`),
        verbosity: num(sm.verbosity, `${tag}.commit.verbosity`),
        erosion: num(sm.erosion, `${tag}.commit.erosion`),
        functions: num(sm.functions, `${tag}.commit.functions`),
        cc_avg: num(sm.cc_avg, `${tag}.commit.cc_avg`),
      },
    } satisfies HistorianCommit;
  });
  // copy, never mutate the caller's object
  const metaRaw = (d.meta ?? {}) as Record<string, unknown>;
  const meta = {
    tool: typeof metaRaw.tool === "string" ? metaRaw.tool : "historian",
    cc_threshold: typeof metaRaw.cc_threshold === "number" ? metaRaw.cc_threshold : 10,
    ...metaRaw,
    trajectory: (metaRaw.trajectory as Trajectory | undefined) ?? trajectoryOf(commits),
  };
  // config passes through unvalidated (no shape checks) and is
  // shallow-copied so we never alias — and never mutate — the caller.
  const configRaw = d.config;
  const config =
    typeof configRaw === "object" && configRaw !== null && !Array.isArray(configRaw)
      ? { ...(configRaw as Record<string, unknown>) }
      : (configRaw as HistorianData["config"]);
  return { meta, commits, ...(config !== undefined ? { config } : {}) } as HistorianData;
}

export interface Filters {
  author: string;
  search: string;
  from: string; // yyyy-mm-dd or ""
  to: string;
}

export interface FilterResult {
  commits: HistorianCommit[];
  badDate: boolean;
}

export function applyFilters(commits: HistorianCommit[], f: Filters): FilterResult {
  const q = f.search.trim().toLowerCase();
  const from = f.from ? Date.parse(f.from + "T00:00:00Z") / 1000 : -Infinity;
  const to = f.to ? Date.parse(f.to + "T23:59:59Z") / 1000 : Infinity;
  const badDate =
    (f.from !== "" && !Number.isFinite(from)) || (f.to !== "" && !Number.isFinite(to));
  if (badDate) return { commits: [], badDate: true };
  return {
    badDate: false,
    commits: commits.filter((c) => {
      if (f.author && c.author !== f.author) return false;
      if (c.time < from || c.time > to) return false;
      if (q) {
        const hay = `${c.subject} ${c.body} ${c.sha} ${c.author} ${c.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }),
  };
}

export function fmt(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function fmtDate(epochSec: number): string {
  if (!Number.isFinite(epochSec)) return "—";
  const d = new Date(epochSec * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

/** Multi-repo overlay views. */

export const METRICS: readonly { key: MetricKey; label: string }[] = [
  { key: "verbosity", label: "verbosity" },
  { key: "erosion", label: "erosion" },
  { key: "loc", label: "loc" },
  { key: "cc_avg", label: "cc avg" },
  { key: "functions", label: "functions" },
];

export function metricValue(c: HistorianCommit, m: MetricKey): number {
  return c.commit[m];
}

export function metricSeries(commits: HistorianCommit[], m: MetricKey): number[] {
  return commits.map((c) => metricValue(c, m));
}

/** First commit time of a repo (0 when empty). */
export function repoT0(commits: HistorianCommit[]): number {
  return commits.length ? commits[0].time : 0;
}

/**
 * X coordinate for overlay charts.
 * commit-rel normalizes position to [0,1] (guard: n<=1 -> 0).
 */
export function xValue(
  mode: XMode,
  index: number,
  n: number,
  time: number,
  t0: number,
): number {
  switch (mode) {
    case "time-abs":
      return time;
    case "time-rel":
      return time - t0;
    case "commit-abs":
      return index;
    case "commit-rel":
      return n <= 1 ? 0 : index / (n - 1);
  }
}

export function xLabel(mode: XMode): string {
  switch (mode) {
    case "time-abs":
      return "time";
    case "time-rel":
      return "time since first commit";
    case "commit-abs":
      return "commit #";
    case "commit-rel":
      return "relative position";
  }
}

/**
 * Per-repo overlay series. Hidden repos are excluded; repos with no
 * commits get points: []. Points never alias across repos with the same
 * sha (each point object is freshly built).
 */
export function overlaySeries(
  repos: RepoEntry[],
  visible: Set<RepoId> | RepoId[],
  mode: XMode,
  metric: MetricKey,
): OverlaySeries[] {
  const vis = visible instanceof Set ? visible : new Set(visible);
  const out: OverlaySeries[] = [];
  for (const r of repos) {
    if (!vis.has(r.id)) continue;
    const commits = r.data.commits;
    const n = commits.length;
    const t0 = repoT0(commits);
    const points: OverlayPoint[] = commits.map((c, i) => ({
      x: xValue(mode, i, n, c.time, t0),
      y: metricValue(c, metric),
      sha: c.sha,
    }));
    out.push({ repoId: r.id, label: r.label, color: r.color, points });
  }
  return out;
}

/** Max y over overlay series, floored at 1e-9 so scaling never divides by 0. */
export function yMax(series: OverlaySeries[]): number {
  let m = 1e-9;
  for (const s of series) {
    for (const p of s.points) {
      if (p.y > m) m = p.y;
    }
  }
  return m;
}

/**
 * SVG path for a polyline of (xs, ys) in a W×H box with PAD padding.
 * max<=0 disables vertical scaling (flat line at bottom).
 */
export function linePath(
  xs: number[],
  ys: number[],
  max: number,
  W: number,
  H: number,
  PAD: number,
): string {
  const n = xs.length;
  const X = (i: number) => PAD + (i / Math.max(n - 1, 1)) * (W - 2 * PAD);
  const Y = (v: number) => H - PAD - (max > 0 ? v / max : 0) * (H - 2 * PAD);
  return xs.map((_, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(" ");
}
