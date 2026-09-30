import { describe, expect, it } from "vitest";
import { applyFilters, linearFit, metricSeries, overlaySeries, parseHistorian, sortCommits, trajectoryOf, velocities, xValue } from "./parse";
import type { HistorianCommit, RepoEntry } from "./types";

const mk = (over: Partial<HistorianCommit>): HistorianCommit => ({
  sha: "x",
  time: 1700000000,
  author: "dev",
  email: "d@e",
  subject: "s",
  body: "",
  permalink: null,
  files: {},
  commit: { loc: 10, verbosity: 0, erosion: 0, functions: 1, cc_avg: 1 },
  ...over,
});

describe("linearFit (mirrors historian/formulas.py)", () => {
  it("empty/single/constant", () => {
    expect(linearFit([], [])).toEqual({ slope: 0, intercept: 0 });
    expect(linearFit([0], [3])).toEqual({ slope: 0, intercept: 3 });
    expect(linearFit([0, 1, 2], [5, 5, 5]).slope).toBeCloseTo(0);
  });
  it("unit slope", () => {
    const { slope, intercept } = linearFit([0, 1, 2], [1, 2, 3]);
    expect(slope).toBeCloseTo(1);
    expect(intercept).toBeCloseTo(1);
  });
});

describe("trajectoryOf", () => {
  it("delta + beta", () => {
    const cs = [
      mk({ sha: "a", commit: { loc: 1, verbosity: 0, erosion: 0, functions: 1, cc_avg: 1 } }),
      mk({ sha: "b", commit: { loc: 1, verbosity: 0.2, erosion: 0.4, functions: 1, cc_avg: 1 } }),
    ];
    const t = trajectoryOf(cs);
    expect(t.delta_v).toBeCloseTo(0.2);
    expect(t.delta_e).toBeCloseTo(0.4);
    expect(t.beta_v).toBeCloseTo(0.2);
  });
  it("empty", () => {
    expect(trajectoryOf([])).toEqual({ delta_v: 0, delta_e: 0, beta_v: 0, beta_e: 0 });
  });
});

describe("velocities", () => {
  it("first-differences, first row zero", () => {
    const cs = [
      mk({ sha: "a", commit: { loc: 10, verbosity: 0.1, erosion: 0, functions: 1, cc_avg: 1 } }),
      mk({ sha: "b", commit: { loc: 14, verbosity: 0.3, erosion: 0.5, functions: 1, cc_avg: 1 } }),
    ];
    const v = velocities(cs);
    expect(v[0]).toEqual({ sha: "a", dV: 0, dE: 0, dLoc: 0 });
    expect(v[1].dV).toBeCloseTo(0.2);
    expect(v[1].dE).toBeCloseTo(0.5);
    expect(v[1].dLoc).toBe(4);
  });
});

describe("sortCommits", () => {
  const cs = [
    mk({ sha: "b", author: "bob", subject: "zebra", time: 2, commit: { loc: 5, verbosity: 0.5, erosion: 0, functions: 1, cc_avg: 1 } }),
    mk({ sha: "a", author: "alice", subject: "apple", time: 1, commit: { loc: 9, verbosity: 0.1, erosion: 0.2, functions: 1, cc_avg: 3 } }),
    mk({ sha: "c", author: "alice", subject: "mango", time: 3, commit: { loc: 9, verbosity: 0.1, erosion: 0.1, functions: 1, cc_avg: 2 } }),
  ];
  it("sorts by key both directions", () => {
    expect(sortCommits(cs, "author", 1).map((c) => c.sha)).toEqual(["a", "c", "b"]);
    expect(sortCommits(cs, "loc", -1).map((c) => c.sha)).toEqual(["a", "c", "b"]);
  });
  it("ties break by commit order, not sha", () => {
    // a and c tie on loc and verbosity; original order is b(0), a(1), c(2) -> a before c either way
    expect(sortCommits(cs, "verbosity", 1).map((c) => c.sha)).toEqual(["a", "c", "b"]);
    expect(sortCommits(cs, "verbosity", -1).map((c) => c.sha)).toEqual(["b", "a", "c"]);
  });
});

describe("parseHistorian", () => {
  it("rejects bad shape", () => {
    expect(() => parseHistorian({})).toThrow(/commits/);
    expect(() => parseHistorian({ commits: [{ sha: "a" }] })).toThrow();
  });
  it("fills missing trajectory", () => {
    const d = parseHistorian({ meta: { tool: "h", cc_threshold: 10 }, commits: [] } as never);
    expect(d.meta.trajectory.delta_v).toBe(0);
  });
  it("rejects mistyped internals with index context", () => {
    expect(() =>
      parseHistorian({ commits: [mk({ commit: { loc: "x" } as never })] }),
    ).toThrow(/commit\[0\].*loc/);
    expect(() =>
      parseHistorian({ commits: [mk({ time: "yesterday" as never })] }),
    ).toThrow(/non-numeric time/);
    expect(() => parseHistorian({ commits: [null] })).toThrow(/commit\[0\]/);
  });
  it("coerces missing strings, defaults files, copies meta", () => {
    const src = { meta: { tool: "h" }, commits: [{ ...mk({}), author: undefined, files: null }] };
    const d = parseHistorian(src as never);
    expect(d.commits[0].author).toBe("?");
    expect(d.commits[0].files).toEqual({});
    expect(d.meta).not.toBe(src.meta);
  });
});

describe("applyFilters", () => {
  const cs = [
    mk({ sha: "aa", author: "alice", subject: "fix bug", time: 1700000000 }),
    mk({ sha: "bb", author: "bob", subject: "add feature", time: 1700100000 }),
  ];
  const Pass = { author: "", search: "", from: "", to: "" };
  it("author/search/date", () => {
    expect(applyFilters(cs, { ...Pass, author: "alice" }).commits).toHaveLength(1);
    expect(applyFilters(cs, { ...Pass, search: "feature" }).commits[0].sha).toBe("bb");
    expect(
      applyFilters(cs, { ...Pass, from: "2023-11-16" }).commits,
    ).toHaveLength(1);
  });
  it("bad date flags instead of silently ignoring", () => {
    const r = applyFilters(cs, { ...Pass, from: "not-a-date" });
    expect(r.badDate).toBe(true);
    expect(r.commits).toHaveLength(0);
    expect(applyFilters(cs, Pass).badDate).toBe(false);
  });
});

const hc = (over: Partial<HistorianCommit>): HistorianCommit => mk(over);

const repoEntry = ({ commits, ...rest }: Partial<RepoEntry> & { commits: HistorianCommit[] }): RepoEntry => ({
  id: "r",
  label: "repo",
  color: "#000",
  filename: "r.json",
  data: {
    meta: { tool: "h", cc_threshold: 10, trajectory: { delta_v: 0, delta_e: 0, beta_v: 0, beta_e: 0 } },
    commits,
  },
  ...rest,
});

describe("xValue", () => {
  it("all four modes", () => {
    expect(xValue("time-abs", 1, 3, 1700100000, 1700000000)).toBe(1700100000);
    expect(xValue("time-rel", 1, 3, 1700100000, 1700000000)).toBe(100000);
    expect(xValue("commit-abs", 2, 3, 1700200000, 1700000000)).toBe(2);
    expect(xValue("commit-rel", 1, 3, 1700100000, 1700000000)).toBeCloseTo(0.5);
    expect(xValue("commit-rel", 0, 3, 1700000000, 1700000000)).toBe(0);
    expect(xValue("commit-rel", 2, 3, 1700200000, 1700000000)).toBe(1);
  });
  it("n=1 guard returns 0 for commit-rel", () => {
    expect(xValue("commit-rel", 0, 1, 1700000000, 1700000000)).toBe(0);
  });
});

describe("metricSeries", () => {
  it("extracts per-commit values for every metric", () => {
    const cs = [
      hc({ sha: "a", commit: { loc: 10, verbosity: 0.1, erosion: 0.2, functions: 3, cc_avg: 1.5 } }),
      hc({ sha: "b", commit: { loc: 20, verbosity: 0.3, erosion: 0.4, functions: 5, cc_avg: 2.5 } }),
    ];
    expect(metricSeries(cs, "verbosity")).toEqual([0.1, 0.3]);
    expect(metricSeries(cs, "erosion")).toEqual([0.2, 0.4]);
    expect(metricSeries(cs, "loc")).toEqual([10, 20]);
    expect(metricSeries(cs, "cc_avg")).toEqual([1.5, 2.5]);
    expect(metricSeries(cs, "functions")).toEqual([3, 5]);
  });
});

describe("overlaySeries", () => {
  const commits = [
    hc({ sha: "a", time: 1700000000, commit: { loc: 10, verbosity: 0.1, erosion: 0, functions: 1, cc_avg: 1 } }),
    hc({ sha: "b", time: 1700100000, commit: { loc: 20, verbosity: 0.3, erosion: 0, functions: 1, cc_avg: 1 } }),
  ];
  it("per-repo t0 points use each repo's own first commit time", () => {
    const repos = [
      repoEntry({ id: "r1", label: "one", color: "red", commits }),
      repoEntry({ id: "r2", label: "two", color: "blue", commits: commits.map((c) => ({ ...c, time: c.time + 500000 })) }),
    ];
    const [s1, s2] = overlaySeries(repos, new Set(["r1", "r2"]), "time-rel", "verbosity");
    expect(s1.points.map((p) => p.x)).toEqual([0, 100000]);
    expect(s2.points.map((p) => p.x)).toEqual([0, 100000]);
    expect(s1.repoId).toBe("r1");
    expect(s2.color).toBe("blue");
    expect(s1.points.map((p) => p.y)).toEqual([0.1, 0.3]);
  });
  it("same-sha commits across repos yield independent points", () => {
    const repos = [
      repoEntry({ id: "r1", commits }),
      repoEntry({ id: "r2", commits }),
    ];
    const [s1, s2] = overlaySeries(repos, ["r1", "r2"], "commit-abs", "verbosity");
    expect(s1.points).toHaveLength(2);
    expect(s1.points[0]).not.toBe(s2.points[0]);
    s1.points[0].x = 999;
    expect(s2.points[0].x).toBe(0);
  });
  it("points carry sha + subject for tooltips", () => {
    const cs = [
      hc({ sha: "a", subject: "fix bug", time: 1700000000, commit: { loc: 10, verbosity: 0.1, erosion: 0, functions: 1, cc_avg: 1 } }),
      hc({ sha: "b", subject: "add feature", time: 1700100000, commit: { loc: 20, verbosity: 0.3, erosion: 0, functions: 1, cc_avg: 1 } }),
    ];
    const [s] = overlaySeries([repoEntry({ id: "r1", commits: cs })], new Set(["r1"]), "commit-abs", "verbosity");
    expect(s.points.map((p) => [p.sha, p.subject])).toEqual([["a", "fix bug"], ["b", "add feature"]]);
  });
  it("empty repos get points [] and hidden repos are excluded", () => {
    const repos = [
      repoEntry({ id: "r1", commits }),
      repoEntry({ id: "empty", commits: [] }),
      repoEntry({ id: "hidden", commits }),
    ];
    const out = overlaySeries(repos, new Set(["r1", "empty"]), "commit-rel", "loc");
    expect(out.map((s) => s.repoId)).toEqual(["r1", "empty"]);
    expect(out[1].points).toEqual([]);
    expect(out[0].points.map((p) => p.sha)).toEqual(["a", "b"]);
  });
});
