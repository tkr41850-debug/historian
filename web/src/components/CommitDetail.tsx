import { useEffect } from "react";
import type { HistorianCommit } from "../types";
import { fmt, fmtDate } from "../parse";

interface CycleInfo {
  cycles: string[][];
  cycle_count: number;
}

function cyclesOf(commit: HistorianCommit): CycleInfo | null {
  const r = commit.repo?.import_cycles as
    | { cycles?: unknown; cycle_count?: unknown }
    | undefined;
  if (!r || !Array.isArray(r.cycles)) return null;
  const cycles = (r.cycles as unknown[]).filter(Array.isArray) as string[][];
  const cycle_count =
    typeof r.cycle_count === "number" ? r.cycle_count : cycles.length;
  return { cycles, cycle_count };
}

export default function CommitDetail({
  commit,
  onClose,
}: {
  commit: HistorianCommit | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  if (!commit)
    return <p style={{ color: "#666" }}>Click a commit (chart or table) to inspect it.</p>;

  const files = commit.files && typeof commit.files === "object" ? commit.files : {};
  const rows = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
  const cyc = cyclesOf(commit);

  return (
    <div
      role="dialog"
      aria-label={`commit ${commit.sha.slice(0, 8)} detail`}
      tabIndex={-1}
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "4px 16px 16px",
        background: "#fcfcfc",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h3 style={{ marginBottom: 4, flex: 1 }}>
          <code>{commit.sha.slice(0, 12)}</code> — {commit.subject}
        </h3>
        <button onClick={onClose} aria-label="close detail">
          ×
        </button>
      </div>
      <p style={{ color: "#555", fontSize: 13 }}>
        {commit.author} &lt;{commit.email}&gt; · {fmtDate(commit.time)} ·{" "}
        <span className="num">
          LOC {commit.commit.loc} · V {fmt(commit.commit.verbosity)} · E {fmt(commit.commit.erosion)} ·{" "}
          {commit.commit.functions} fns · CCavg {fmt(commit.commit.cc_avg, 2)}
        </span>{" "}·{" "}
        {commit.permalink ? (
          <a href={commit.permalink} target="_blank" rel="noreferrer">permalink</a>
        ) : (
          "no permalink"
        )}
      </p>
      {commit.body && <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{commit.body}</pre>}
      <h4>
        import cycles{cyc ? ` (${cyc.cycle_count})` : ""}
      </h4>
      {!cyc || cyc.cycles.length === 0 ? (
        <p style={{ color: "#666", fontSize: 12 }}>No import cycles in this commit.</p>
      ) : (
        <ul style={{ fontSize: 12 }}>
          {cyc.cycles.map((c, i) => (
            <li key={i}>
              <code>{c.join(" → ")}</code>
            </li>
          ))}
        </ul>
      )}
      <h4>per-file metrics ({rows.length} files)</h4>
      {rows.length === 0 ? (
        <p style={{ color: "#666", fontSize: 12 }}>No files recorded for this commit.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
                <th>path</th>
                <th style={{ textAlign: "right" }}>LOC</th>
                <th style={{ textAlign: "right" }}>CCmax</th>
                <th style={{ textAlign: "right" }}>mass</th>
                <th style={{ textAlign: "right" }}>er(fn&gt;10)</th>
                <th style={{ textAlign: "right" }}>clones</th>
                <th>AST hits</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([path, m]) => (
                <tr key={path} style={{ borderBottom: "1px solid #eee" }}>
                  <td><code>{path}</code></td>
                  <td style={{ textAlign: "right" }}>{m.loc?.loc ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{m.cc?.cc_max ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{m.complexity ? fmt(m.complexity.mass, 1) : "—"}</td>
                  <td style={{ textAlign: "right" }}>{m.complexity?.functions_over_10 ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{m.duplication?.clone_lines ?? "—"}</td>
                  <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {(m.verbosity?.ast_hits ?? []).slice(0, 12).join(", ")}
                    {(m.verbosity?.rules?.length ?? 0) > 0 && (
                      <span style={{ color: "#888" }}> ({m.verbosity?.rules?.length} rules)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
