import type { HistorianCommit } from "../types";
import { fmt, fmtDate } from "../parse";

export default function CommitDetail({ commit }: { commit: HistorianCommit | null }) {
  if (!commit) return <p style={{ color: "#666" }}>Click a commit (chart or table) to inspect it.</p>;
  const rows = Object.entries(commit.files).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div>
      <h3 style={{ marginBottom: 4 }}>
        <code>{commit.sha.slice(0, 12)}</code> — {commit.subject}
      </h3>
      <p style={{ color: "#555", fontSize: 13 }}>
        {commit.author} &lt;{commit.email}&gt; · {fmtDate(commit.time)} · LOC {commit.commit.loc} ·{" "}
        V {fmt(commit.commit.verbosity)} · E {fmt(commit.commit.erosion)} · {commit.commit.functions} fns · CCavg{" "}
        {fmt(commit.commit.cc_avg, 2)} ·{" "}
        {commit.permalink ? (
          <a href={commit.permalink} target="_blank" rel="noreferrer">permalink</a>
        ) : (
          "no permalink"
        )}
      </p>
      {commit.body && <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{commit.body}</pre>}
      <h4>per-file metrics ({rows.length} files)</h4>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
