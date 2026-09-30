/** Historian JSON shape (mirrors historian/runner.py output). */

export interface Trajectory {
  delta_v: number;
  delta_e: number;
  beta_v: number;
  beta_e: number;
}

export interface CommitSummary {
  loc: number;
  verbosity: number;
  erosion: number;
  functions: number;
  cc_avg: number;
}

export interface LocMetrics {
  loc: number;
  sloc: number;
  blank: number;
  comment: number;
}

export interface CcFunction {
  name: string;
  cc: number;
  sloc: number;
  start: number;
  end: number;
}

export interface CcMetrics {
  functions: CcFunction[];
  cc_max: number;
  cc_avg: number;
}

export interface ComplexityMetrics {
  mass: number;
  erosion: number;
  functions_over_10: number;
}

/** Per-file metrics keyed by plugin name; known plugins typed, extras allowed. */
export interface FileMetrics {
  loc?: LocMetrics;
  cc?: CcMetrics;
  complexity?: ComplexityMetrics;
  duplication?: { clone_lines: number };
  verbosity?: { ast_hits: number[]; rules: string[] };
  import_cycles?: { imports: string[] };
  [plugin: string]: unknown;
}

export interface HistorianCommit {
  sha: string;
  time: number;
  author: string;
  email: string;
  subject: string;
  body: string;
  permalink: string | null;
  files: Record<string, FileMetrics>;
  repo?: Record<string, unknown>;
  commit: CommitSummary;
}

export interface HistorianData {
  meta: {
    tool: string;
    cc_threshold: number;
    trajectory: Trajectory;
    [k: string]: unknown;
  };
  commits: HistorianCommit[];
  config?: { github_url?: unknown; [k: string]: unknown };
}

/** Multi-repo overlay views. */

export type RepoId = string;

export interface RepoEntry {
  id: RepoId;
  label: string;
  color: string;
  filename: string;
  data: HistorianData;
}

export interface Selection {
  repoId: RepoId;
  sha: string;
}

export type XMode = "time-abs" | "time-rel" | "commit-rel" | "commit-abs";

export type MetricKey = "verbosity" | "erosion" | "loc" | "cc_avg" | "functions";

export type ViewMode = "combined" | "single" | "grid";

export interface OverlayPoint {
  x: number;
  y: number;
  sha: string;
  subject: string;
}

export interface OverlaySeries {
  repoId: RepoId;
  label: string;
  color: string;
  points: OverlayPoint[];
}
