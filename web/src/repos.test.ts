import { describe, expect, it } from "vitest";
import {
  addRepos,
  colorForOrder,
  deriveRepoLabel,
  filenameStem,
  removeRepo,
  REPO_PALETTE,
  uniqueLabel,
} from "./repos";
import { parseHistorian } from "./parse";

const DATA = (config?: unknown, meta?: Record<string, unknown>) =>
  ({
    meta: { tool: "h", cc_threshold: 10, trajectory: { delta_v: 0, delta_e: 0, beta_v: 0, beta_e: 0 }, ...(meta ?? {}) },
    commits: [],
    ...(config === undefined ? {} : { config }),
  }) as never;

describe("deriveRepoLabel", () => {
  it("prefers config.github_url last segment minus .git", () => {
    expect(
      deriveRepoLabel(DATA({ github_url: "https://github.com/acme/api.git" }), "x.json"),
    ).toBe("api");
    expect(
      deriveRepoLabel(DATA({ github_url: "https://github.com/acme/web/" }), "x.json"),
    ).toBe("web");
  });
  it("falls back meta.repo, meta.name, meta.github_url, stem, repo", () => {
    expect(deriveRepoLabel(DATA(undefined, { repo: "r1" }), "x.json")).toBe("r1");
    expect(deriveRepoLabel(DATA(undefined, { name: "n1" }), "x.json")).toBe("n1");
    expect(
      deriveRepoLabel(DATA(undefined, { github_url: "https://github.com/a/b.git" }), "x.json"),
    ).toBe("b");
    expect(deriveRepoLabel(DATA(undefined), "my-report.json")).toBe("my-report");
    expect(deriveRepoLabel(DATA(undefined), "")).toBe("repo");
    expect(deriveRepoLabel(null, "")).toBe("repo");
  });
  it("ignores blank strings and non-string values", () => {
    expect(deriveRepoLabel(DATA({ github_url: "  " }, { repo: "r" }), "f.json")).toBe("r");
    expect(deriveRepoLabel(DATA({ github_url: 7 }, {}), "f.json")).toBe("f");
  });
});

describe("uniqueLabel", () => {
  it("dedupes case-insensitively with (2) suffix", () => {
    expect(uniqueLabel("api", ["API"])).toBe("api (2)");
    expect(uniqueLabel("api", ["api", "api (2)"])).toBe("api (3)");
    expect(uniqueLabel("api", [])).toBe("api");
    expect(uniqueLabel("  ", [])).toBe("repo");
  });
});

describe("addRepos/removeRepo", () => {
  it("assigns unique labels and stable stored colors, never mutates", () => {
    const cur = addRepos([], [
      { filename: "a.json", data: parseHistorian(DATA({ github_url: "https://github.com/x/api.git" })) },
      { filename: "b.json", data: parseHistorian(DATA({ github_url: "https://github.com/y/api.git" })) },
    ]);
    expect(cur.map((r) => r.label)).toEqual(["api", "api (2)"]);
    expect(cur[0].color).toBe(REPO_PALETTE[0]);
    expect(cur[1].color).toBe(colorForOrder(1));
    expect(cur[0].id).not.toBe(cur[1].id);
    const after = removeRepo(cur, cur[0].id);
    expect(after).toHaveLength(1);
    expect(after[0].color).toBe(cur[1].color); // stable: no recolor on remove
    expect(cur).toHaveLength(2); // input untouched
  });
});

describe("filenameStem", () => {
  it("strips dirs and last extension", () => {
    expect(filenameStem("dir/report.json")).toBe("report");
    expect(filenameStem("a.b.json")).toBe("a.b");
    expect(filenameStem("noext")).toBe("noext");
  });
});
