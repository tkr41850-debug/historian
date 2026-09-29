import { useMemo, useState } from "react";
import DropZone from "./components/DropZone";
import TrajectoryChart from "./components/TrajectoryChart";
import CommitTable from "./components/CommitTable";
import CommitDetail from "./components/CommitDetail";
import FilterBar from "./components/Filters";
import { applyFilters, fmt, parseHistorian, trajectoryOf, type Filters } from "./parse";
import type { HistorianData } from "./types";
import sample from "./sample.json";

const EMPTY: Filters = { author: "", search: "", from: "", to: "" };

export default function App() {
  const [data, setData] = useState<HistorianData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [selected, setSelected] = useState<string | null>(null);

  const loadFile = async (f: File) => {
    try {
      const text = await f.text();
      setData(parseHistorian(JSON.parse(text)));
      setError(null);
      setSelected(null);
      setFilters(EMPTY);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadSample = () => {
    setData(parseHistorian(sample));
    setError(null);
    setSelected(null);
    setFilters(EMPTY);
  };

  const commits = data?.commits ?? [];
  const authors = useMemo(() => [...new Set(commits.map((c) => c.author))].sort(), [commits]);
  const filtered = useMemo(() => applyFilters(commits, filters), [commits, filters]);
  const traj = data?.meta.trajectory ?? trajectoryOf(filtered);
  const sel = filtered.find((c) => c.sha === selected) ?? filtered[filtered.length - 1] ?? null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 4 }}>Historian — repo slop trajectory</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Verbosity V = |L<sub>AST</sub> ∪ L<sub>clone</sub>| / LOC · Erosion E = Σ<sub>CC&gt;10</sub>mass / Σmass ·
        mass = CC·√SLOC · β via least-squares
      </p>

      {!data && (
        <>
          <DropZone onFile={loadFile} />
          <p style={{ textAlign: "center" }}>
            <button onClick={loadSample}>load sample</button>
          </p>
        </>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {data && (
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
              <DropZone onFile={loadFile} />
            </div>
          </div>

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

          <h2>Commit detail</h2>
          <CommitDetail commit={sel} />
        </>
      )}
    </div>
  );
}
