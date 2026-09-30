import type { HistorianData, RepoEntry, RepoId } from "./types";

/** 8-color categorical palette (Okabe–Ito, colorblind-safe). */
export const REPO_PALETTE: readonly string[] = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
  "#999999",
];

/** Stable color by insertion order (wraps after 8). */
export function colorForOrder(order: number): string {
  const n = REPO_PALETTE.length;
  return REPO_PALETTE[((order % n) + n) % n];
}

/** Basename without directories and without the last dot-extension. */
export function filenameStem(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot > 0) return base.slice(0, dot);
  return base;
}

function cleanStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

/** Last URL path segment, minus a trailing .git and trailing slashes. */
function lastSegment(url: string): string | undefined {
  const noTrail = url.trim().replace(/\/+$/, "");
  if (noTrail === "") return undefined;
  const seg = noTrail.split("/").pop() ?? "";
  const stripped = seg.endsWith(".git") ? seg.slice(0, -4) : seg;
  const t = stripped.trim();
  return t === "" ? undefined : t;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (typeof v === "object" && v !== null && !Array.isArray(v))
    return v as Record<string, unknown>;
  return undefined;
}

/**
 * Label precedence: config.github_url (last segment, minus .git), then
 * meta.repo / meta.name raw strings, then meta.github_url (last segment),
 * then filename stem, then "repo".
 */
export function deriveRepoLabel(raw: unknown, filename: string): string {
  const root = asRecord(raw);
  const config = root ? asRecord(root.config) : undefined;
  const gh = config ? cleanStr(config.github_url) : undefined;
  if (gh) {
    const seg = lastSegment(gh);
    if (seg) return seg;
  }
  const meta = root ? asRecord(root.meta) : undefined;
  if (meta) {
    const repo = cleanStr(meta.repo);
    if (repo) return repo;
    const name = cleanStr(meta.name);
    if (name) return name;
    const mgh = cleanStr(meta.github_url);
    if (mgh) {
      const seg = lastSegment(mgh);
      if (seg) return seg;
    }
  }
  const stem = filenameStem(filename).trim();
  if (stem !== "") return stem;
  return "repo";
}

/** Dedupe case-insensitively: base, base (2), base (3), … */
export function uniqueLabel(base: string, existing: Iterable<string>): string {
  const clean = base.trim() === "" ? "repo" : base.trim();
  const taken = new Set<string>();
  for (const e of existing) taken.add(e.toLowerCase());
  if (!taken.has(clean.toLowerCase())) return clean;
  let i = 2;
  while (taken.has(`${clean} (${i})`.toLowerCase())) i++;
  return `${clean} (${i})`;
}

export function makeRepoId(): RepoId {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (c?.randomUUID) {
    try {
      return c.randomUUID();
    } catch {
      /* fall through to Math.random fallback */
    }
  }
  const rand = Math.floor(Math.random() * 0xffffffff)
    .toString(36)
    .padStart(7, "0");
  return `repo-${Date.now().toString(36)}-${rand}`;
}

/**
 * Append repos: derive + dedupe labels, assign stable stored colors by
 * insertion order. Never mutates inputs.
 */
export function addRepos(
  current: RepoEntry[],
  additions: Array<{ filename: string; data: HistorianData }>,
): RepoEntry[] {
  const out = [...current];
  for (const a of additions) {
    const base = deriveRepoLabel(a.data, a.filename);
    const label = uniqueLabel(
      base,
      out.map((r) => r.label),
    );
    out.push({
      id: makeRepoId(),
      label,
      color: colorForOrder(out.length),
      filename: a.filename,
      data: a.data,
    });
  }
  return out;
}

export function removeRepo(current: RepoEntry[], id: RepoId): RepoEntry[] {
  return current.filter((r) => r.id !== id);
}
