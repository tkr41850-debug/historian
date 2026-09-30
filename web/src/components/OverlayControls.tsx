import { METRICS, xLabel } from "../parse";
import type { MetricKey, ViewMode, XMode } from "../types";

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "combined", label: "combined" },
  { key: "single", label: "single" },
  { key: "grid", label: "grid" },
];

const XMODES: { key: XMode; label: string }[] = [
  { key: "time-abs", label: "time" },
  { key: "time-rel", label: "time since first" },
  { key: "commit-abs", label: "commit #" },
  { key: "commit-rel", label: "relative position" },
];

function btn(active: boolean): React.CSSProperties {
  return {
    border: "1px solid #ccc",
    borderRadius: 999,
    padding: "2px 10px",
    background: active ? "#eef4ff" : "#fff",
    fontWeight: active ? 700 : 400,
    cursor: "pointer",
    fontSize: 12,
  };
}

export default function OverlayControls({
  view,
  xMode,
  metric,
  onView,
  onXMode,
  onMetric,
}: {
  view: ViewMode;
  xMode: XMode;
  metric: MetricKey;
  onView: (v: ViewMode) => void;
  onXMode: (x: XMode) => void;
  onMetric: (m: MetricKey) => void;
}) {
  // the metric picker only affects the single-repo chart; the combined
  // view always shows verbosity+erosion and the grid shows all metrics
  const metricEnabled = view === "single";
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "8px 0" }}>
      <div role="group" aria-label="view mode" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {VIEWS.map((v) => (
          <button key={v.key} aria-pressed={view === v.key} onClick={() => onView(v.key)} style={btn(view === v.key)}>
            {v.label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="x axis mode" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {XMODES.map((x) => (
          <button key={x.key} aria-pressed={xMode === x.key} onClick={() => onXMode(x.key)} style={btn(xMode === x.key)}>
            {x.label}
          </button>
        ))}
      </div>
      <span style={{ fontSize: 12, color: "#666" }}>{xLabel(xMode)}</span>
      <label style={{ fontSize: 13 }} title={metricEnabled ? undefined : "metric applies to the single view only"}>
        metric{" "}
        <select
          value={metric}
          onChange={(e) => onMetric(e.target.value as MetricKey)}
          disabled={!metricEnabled}
          aria-label="overlay metric"
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
