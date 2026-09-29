import { describe, expect, it } from "vitest";
import { applyFilters, linearFit, parseHistorian, sortCommits, trajectoryOf, velocities } from "./parse";
import type { HistorianCommit } from "./types";

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
});

describe("applyFilters", () => {
  const cs = [
    mk({ sha: "aa", author: "alice", subject: "fix bug", time: 1700000000 }),
    mk({ sha: "bb", author: "bob", subject: "add feature", time: 1700100000 }),
  ];
  it("author/search/date", () => {
    expect(applyFilters(cs, { author: "alice", search: "", from: "", to: "" })).toHaveLength(1);
    expect(applyFilters(cs, { author: "", search: "feature", from: "", to: "" })[0].sha).toBe("bb");
    expect(
      applyFilters(cs, { author: "", search: "", from: "2023-11-16", to: "" }),
    ).toHaveLength(1);
  });
});
