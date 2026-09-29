import { describe, expect, it } from "vitest";
import { applyFilters, linearFit, parseHistorian, trajectoryOf } from "./parse";
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
