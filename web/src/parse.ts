import type { HistorianCommit, HistorianData, Trajectory } from "./types";

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

export function parseHistorian(raw: unknown): HistorianData {
  if (typeof raw !== "object" || raw === null) throw new Error("JSON must be an object");
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.commits)) throw new Error("JSON missing commits[] (run python -m historian --out historian.json)");
  const commits = (d.commits as HistorianCommit[]).map((c, i) => {
    if (!c.sha || !c.commit) throw new Error(`commit[${i}] missing sha/commit`);
    return c;
  });
  const meta =
    (d.meta as HistorianData["meta"]) ?? {
      tool: "historian",
      cc_threshold: 10,
      trajectory: trajectoryOf(commits),
    };
  if (!meta.trajectory) meta.trajectory = trajectoryOf(commits);
  return { meta, commits };
}

export interface Filters {
  author: string;
  search: string;
  from: string; // yyyy-mm-dd or ""
  to: string;
}

export function applyFilters(commits: HistorianCommit[], f: Filters): HistorianCommit[] {
  const q = f.search.trim().toLowerCase();
  const from = f.from ? Date.parse(f.from + "T00:00:00Z") / 1000 : -Infinity;
  const to = f.to ? Date.parse(f.to + "T23:59:59Z") / 1000 : Infinity;
  return commits.filter((c) => {
    if (f.author && c.author !== f.author) return false;
    if (c.time < from || c.time > to) return false;
    if (q) {
      const hay = `${c.subject} ${c.body} ${c.sha} ${c.author} ${c.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function fmt(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function fmtDate(epochSec: number): string {
  return new Date(epochSec * 1000).toISOString().slice(0, 10);
}
