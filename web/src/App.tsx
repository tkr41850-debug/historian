import { useEffect, useMemo, useState } from "react";
import DropZone from "./components/DropZone";
import TrajectoryChart from "./components/TrajectoryChart";
import CommitTable from "./components/CommitTable";
import CommitDetail from "./components/CommitDetail";
import FilterBar from "./components/Filters";
import { applyFilters, fmt, parseHistorian, trajectoryOf, type Filters } from "./parse";
import type { HistorianData } from "./types";
import sample from "./sample.json";

const EMPTY: Filters = { author: "", search: "", from: "", to: "" };
type Status = "empty" | "reading" | "parsing" | "ready";

export default function App() {
  const [data, setData] = useState<HistorianData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("empty");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [selected, setSelected] = useState<string | null>(null);

  const loadFile = async (f: File) => {
    setStatus("reading");
    setError(null);
    try {
      const text = await f.text();
      setStatus("parsing");
      // yield so the "parsing…" state paints before synchronous JSON.parse
      await new Promise((r) => setTimeout(r, 0));
      setData(parseHistorian(JSON.parse(text)));
      setSelected(null);
      setFilters(EMPTY);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(data ? "ready" : "empty");
    }
  };

  const loadSample = () => {
    try {
      setData(parseHistorian(sample));
      setError(null);
      setSelected(null);
      setFilters(EMPTY);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // close drawer on Escape even when focus is outside the dialog
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const commits = data?.commits ?? [];
  const authors = useMemo(() => [...new Set(commits.map((c) => c.author))].sort(), [commits]);
  const { commits: filtered, badDate } = useMemo(
    () => applyFilters(commits, filters),
    [commits, filters],
  );
  const filtering = filters.author !== "" || filters.search !== "" || filters.from !== "" || filters.to !== "";
  // Stat cards follow the visible (filtered) series so ΔV/ΔE/β stay
  // correct under filters; fall back to the full-file trajectory only
  // when nothing is filtered.
  const traj = filtering || !data?.meta.trajectory ? trajectoryOf(filtered) : data.meta.trajectory;
  const sel =
    selected != null
      ? (filtered.find((c) => c.sha === selected) ?? null)
      : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 4 }}>Historian — repo slop trajectory</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Verbosity V = |L<sub>AST</sub> ∪ L<sub>clone</sub>| / LOC · Erosion E = Σ<sub>CC&gt;10</sub>mass / Σmass ·
        mass = CC·√SLOC · β via least-squares
      </p>

      {status === "empty" && (
        <>
          <DropZone onFile={loadFile} error={error} />
          <p style={{ textAlign: "center" }}>
            <button onClick={loadSample}>load sample</button>
          </p>
        </>
      )}
      {(status === "reading" || status === "parsing") && (
        <p role="status">{status === "reading" ? "Reading file…" : "Parsing historian JSON…"}</p>
      )}

      {status === "ready" && data && (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "12px 0" }}>
            {[
              ["ΔV", traj.delta_v],
              ["ΔE", traj.delta_e],
              ["β_V", traj.beta_v],
              ["β_E", traj.beta_e],
            ].map(([k, v]) => (
              <div key={k as string} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 16px" }}>
                <div style={{ fontSize: 12, color: "#666" }}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                  {(v as number) >= 0 ? "+" : ""}
                  {fmt(v as number)}
                </div>
              </div>
            ))}
            <div style={{ marginLeft: "auto", alignSelf: "center", display: "flex", gap: 8 }}>
              <DropZone onFile={loadFile} error={error} />
            </div>
          </div>

          {commits.length === 0 ? (
            <p>No commits in this file — load a historian.json with commit data.</p>
          ) : (
            <>
              <h2>Trajectory</h2>
              <TrajectoryChart commits={filtered} selected={sel?.sha ?? null} onSelect={setSelected} />

              <h2>Commits</h2>
              <FilterBar
                value={filters}
                authors={authors}
                onChange={setFilters}
                count={`${filtered.length}/${commits.length} commits`}
              />
              <CommitTable commits={filtered} selected={sel?.sha ?? null} onSelect={setSelected} />
              {badDate && (
                <p role="alert" style={{ color: "#a00" }}>
                  Ignoring an invalid from/to date — use yyyy-mm-dd.
                </p>
              )}

              <h2>Commit detail</h2>
              <CommitDetail commit={sel} onClose={() => setSelected(null)} />
            </>
          )}
        </>
      )}
    </div>
  );
}
