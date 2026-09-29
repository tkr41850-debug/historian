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
}
