import { useEffect, useMemo, useState } from "react";
import DropZone from "./components/DropZone";
import Tex from "./components/Math";
import RepoMenu from "./components/RepoMenu";
import TrajectoryChart from "./components/TrajectoryChart";
import MetricChart from "./components/MetricChart";
import OverlayControls from "./components/OverlayControls";
import CommitTable from "./components/CommitTable";
import CommitDetail from "./components/CommitDetail";
import FilterBar from "./components/Filters";
import {
  applyFilters,
  fmt,
  METRICS,
  metricValue,
  overlaySeries,
  parseHistorian,
  repoT0,
  trajectoryOf,
  xValue,
  type Filters,
} from "./parse";
import type {
  HistorianData,
  MetricKey,
  OverlaySeries,
  RepoEntry,
  RepoId,
  Selection,
  ViewMode,
  XMode,
} from "./types";
import { addRepos, deriveRepoLabel, removeRepo, uniqueLabel } from "./repos";
import sample from "./sample.json";

const EMPTY: Filters = { author: "", search: "", from: "", to: "" };
type Status = "empty" | "reading" | "parsing" | "ready";

export default function App() {
  const [repos, setRepos] = useState<RepoEntry[]>([]);
  const [visible, setVisible] = useState<Set<RepoId>>(new Set());
  const [focusedId, setFocusedId] = useState<RepoId | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [view, setView] = useState<ViewMode>("combined");
  const [xMode, setXMode] = useState<XMode>("commit-rel");
  const [metric, setMetric] = useState<MetricKey>("verbosity");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("empty");

  /** Append parsed additions: labels/colors via addRepos, new ids visible by default. */
  const commitAdditions = (additions: Array<{ filename: string; data: HistorianData }>) => {
    if (additions.length === 0) return;
    const next = addRepos(repos, additions);
    setRepos(next);
    const ids = next.slice(repos.length).map((r) => r.id);
    setVisible((prev) => new Set([...prev, ...ids]));
    // focused sticks to the first repo ever loaded
    setFocusedId((prev) => prev ?? next[0].id);
  };

  const loadFiles = async (fs: File[]) => {
    if (fs.length === 0) return;
    setStatus("reading");
    setErrors([]);
    const additions: Array<{ filename: string; data: HistorianData }> = [];
    const errs: string[] = [];
    for (const f of fs) {
      let label = f.name;
      try {
        const text = await f.text();
        setStatus("parsing");
        // yield so the "parsing…" state paints before synchronous JSON.parse
        await new Promise((r) => setTimeout(r, 0));
        const raw: unknown = JSON.parse(text);
        // derive the display label from the raw JSON before validation,
        // so even a file that fails parseHistorian gets a readable error
        label = deriveRepoLabel(raw, f.name);
        additions.push({ filename: f.name, data: parseHistorian(raw) });
      } catch (e) {
        errs.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    commitAdditions(additions);
    setErrors(errs);
    setStatus(repos.length + additions.length > 0 ? "ready" : "empty");
  };

  const loadSample = () => {
    try {
      // sample.json flows through the same path: filename "sample.json"
      // feeds deriveRepoLabel (inside addRepos) just like a dropped file
      commitAdditions([{ filename: "sample.json", data: parseHistorian(sample) }]);
      setErrors([]);
      setStatus("ready");
    } catch (e) {
      setErrors([`sample.json: ${e instanceof Error ? e.message : String(e)}`]);
    }
  };

  const handleToggle = (id: RepoId) =>
    setVisible((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const handleRemove = (id: RepoId) => {
    const next = removeRepo(repos, id);
    setRepos(next);
    setVisible((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
    // selection is cleared only when its own repo was removed
    setSelected((prev) => (prev?.repoId === id ? null : prev));
    setFocusedId((prev) => (prev === id ? (next[0]?.id ?? null) : prev));
  };

  const handleRename = (id: RepoId, label: string) =>
    setRepos((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              label:
                label.trim() === ""
                  ? r.label
                  : uniqueLabel(
                      label.trim(),
                      prev.filter((s) => s.id !== id).map((s) => s.label),
                    ),
            }
          : r,
      ),
    );

  // close detail on Escape even when focus is outside the dialog
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---- derived: everything per-repo, never aggregated across repos ----
  const enabledRepos = useMemo(() => repos.filter((r) => visible.has(r.id)), [repos, visible]);
  const focused = useMemo(
    () => repos.find((r) => r.id === focusedId) ?? null,
    [repos, focusedId],
  );
  const focusedCommits = focused?.data.commits ?? [];
  const authors = useMemo(
    () => [...new Set(focusedCommits.map((c) => c.author))].sort(),
    [focusedCommits],
  );
  const { commits: filtered, badDate } = useMemo(
    () => applyFilters(focusedCommits, filters),
    [focusedCommits, filters],
  );
  const filtering =
    filters.author !== "" || filters.search !== "" || filters.from !== "" || filters.to !== "";
  // Stat cards follow the visible (filtered) series so delta/beta stay
  // correct under filters; fall back to the full-file trajectory only
  // when nothing is filtered.
  const traj =
    focused == null
      ? trajectoryOf([])
      : filtering || !focused.data.meta.trajectory
        ? trajectoryOf(filtered)
        : focused.data.meta.trajectory;
  const sel =
    selected != null && focused != null && selected.repoId === focused.id
      ? (filtered.find((c) => c.sha === selected.sha) ?? null)
      : null;

  const selectInFocused = (sha: string | null) =>
    setSelected(sha == null || focused == null ? null : { repoId: focused.id, sha });
  const selectOverlay = (repoId: RepoId, sha: string) => {
    setFocusedId(repoId);
    setSelected({ repoId, sha });
  };

  // grid: one overlaid compact MetricChart per metric (five total),
  // all sharing the current xMode
  const gridByMetric: Array<{ metric: MetricKey; label: string; series: OverlaySeries[] }> = useMemo(
    () =>
      METRICS.map((m) => ({
        metric: m.key,
        label: m.label,
        series: overlaySeries(enabledRepos, visible, xMode, m.key),
      })),
    [enabledRepos, visible, xMode],
  );

  const empty = repos.length === 0;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 4 }}>Historian — repo slop trajectory</h1>
      <div style={{ color: "#555", marginTop: 0, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Tex block math="\text{mass}(f) = \text{CC}(f)\sqrt{\text{SLOC}(f)}" />
        <Tex block math="E(C) = \frac{\sum_{\text{CC}>10} \text{mass}}{\sum \text{mass}}" />
        <Tex block math="V(C) = \frac{|L_{\text{AST}} \cup L_{\text{clone}}|}{\text{LOC}}" />
        <Tex
          block
          math="T = \{(V_i, E_i)\}, \quad \hat{\beta} = \arg\min_\beta \sum_i (y_i - \beta_0 - \beta_1 x_i)^2"
        />
      </div>

      {empty && status !== "reading" && status !== "parsing" && (
        <>
          <DropZone onFiles={loadFiles} />
          <p style={{ textAlign: "center" }}>
            <button onClick={loadSample}>load sample</button>
          </p>
        </>
      )}
      {(status === "reading" || status === "parsing") && (
        <p role="status">{status === "reading" ? "Reading files…" : "Parsing historian JSON…"}</p>
      )}

      {errors.length > 0 && (
        <ul role="alert" style={{ color: "#b00020", fontSize: 13 }}>
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {!empty && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
            <div style={{ flex: "1 1 280px", minWidth: 240 }}>
              <DropZone onFiles={loadFiles} />
            </div>
          </div>
          <OverlayControls
            view={view}
            xMode={xMode}
            metric={metric}
            onView={setView}
            onXMode={setXMode}
            onMetric={setMetric}
          />

          <RepoMenu
            repos={repos}
            visible={visible}
            focusedId={focused?.id ?? null}
            onToggle={handleToggle}
            onRemove={handleRemove}
            onFocus={setFocusedId}
            onRename={handleRename}
          />

          {focused && (
            <>
              <h2>
                Stats — <span style={{ color: focused.color }}>●</span> {focused.label}
              </h2>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "12px 0" }}>
                {[
                  { math: "\\Delta V", value: traj.delta_v },
                  { math: "\\Delta E", value: traj.delta_e },
                  { math: "\\beta_V", value: traj.beta_v },
                  { math: "\\beta_E", value: traj.beta_e },
                ].map(({ math, value }) => (
                  <div key={math} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 16px" }}>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      <Tex math={math} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>
                      {value >= 0 ? "+" : ""}
                      {fmt(value)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }} aria-label="enabled repos">
                {enabledRepos.map((r) => {
                  const t = trajectoryOf(r.data.commits);
                  const n = r.data.commits.length;
                  return (
                    <span
                      key={r.id}
                      style={{ fontSize: 12, border: "1px solid #ddd", borderRadius: 999, padding: "2px 10px" }}
                      title={`${r.filename}: ${n} commits`}
                    >
                      <span style={{ color: r.color }}>●</span> {r.label} ·{" "}
                      {n === 1 ? "1 commit" : `${n} commits`} · <Tex math="\Delta V" />{" "}
                      {t.delta_v >= 0 ? "+" : ""}
                      {fmt(t.delta_v)} · <Tex math="\Delta E" /> {t.delta_e >= 0 ? "+" : ""}
                      {fmt(t.delta_e)}
                    </span>
                  );
                })}
              </div>
            </>
          )}

          {/* Focused-repo picker lives above the views so the focused
              repo is visible in every view mode, not just combined. */}
          <h3 style={{ margin: "12px 0 4px", fontSize: 14 }}>Focused repo</h3>
          <div role="tablist" aria-label="focused repo" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 8px" }}>
            {repos.map((r) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={focused?.id === r.id}
                onClick={() => setFocusedId(r.id)}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 999,
                  padding: "2px 10px",
                  background: focused?.id === r.id ? "#eef4ff" : "#fff",
                  fontWeight: focused?.id === r.id ? 700 : 400,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <span style={{ color: r.color }}>●</span> {r.label}
              </button>
            ))}
          </div>

          {view === "combined" && (
            <>
              <h2>Overlay — verbosity / erosion</h2>
              <TrajectoryChart
                series={enabledRepos.map((r) => ({
                  commits: r.data.commits,
                  color: r.color,
                  label: r.label,
                  repoId: r.id,
                }))}
                xMode={xMode}
                selected={selected}
                onSelect={selectOverlay}
              />
            </>
          )}

          {view === "single" && focused && (
            <>
              <h2>
                Metric — <span style={{ color: focused.color }}>●</span> {focused.label}
              </h2>
              <MetricChart
                series={[
                  {
                    repoId: focused.id,
                    label: focused.label,
                    color: focused.color,
                    points: (() => {
                      const n = focusedCommits.length;
                      const t0 = repoT0(focusedCommits);
                      return focusedCommits.map((c, i) => ({
                        x: xValue(xMode, i, n, c.time, t0),
                        y: metricValue(c, metric),
                        sha: c.sha,
                      }));
                    })(),
                  },
                ]}
                xMode={xMode}
                metric={metric}
                selection={selected}
                onSelect={selectOverlay}
              />
            </>
          )}

          {view === "grid" && (
            <>
              <h2>Metrics — all repos</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 16,
                }}
              >
                {gridByMetric.map((g) => (
                  <div key={g.metric} style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                    <h3 style={{ margin: "4px 0 8px", fontSize: 14 }}>{g.label}</h3>
                    <MetricChart
                      series={g.series}
                      xMode={xMode}
                      metric={g.metric}
                      height={140}
                      selection={selected}
                      onSelect={selectOverlay}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {focused ? (
            focusedCommits.length === 0 ? (
              <p>No commits in {focused.label} — load a historian.json with commit data.</p>
            ) : (
              <>
                <h2>
                  Commits — <span style={{ color: focused.color }}>●</span> {focused.label}
                </h2>
                <FilterBar
                  value={filters}
                  authors={authors}
                  onChange={setFilters}
                  count={`${filtered.length}/${focusedCommits.length} commits`}
                />
                <CommitTable
                  commits={filtered}
                  selected={sel?.sha ?? null}
                  onSelect={selectInFocused}
                  caption={`showing ${focused.label}`}
                />
                {badDate && (
                  <p role="alert" style={{ color: "#a00" }}>
                    Ignoring an invalid from/to date — use yyyy-mm-dd.
                  </p>
                )}

                <h2>Commit detail</h2>
                <CommitDetail commit={sel} onClose={() => setSelected(null)} />
              </>
            )
          ) : (
            <p style={{ color: "#666" }}>All repos hidden or removed — show a repo to inspect its commits.</p>
          )}
        </>
      )}
    </div>
  );
}
