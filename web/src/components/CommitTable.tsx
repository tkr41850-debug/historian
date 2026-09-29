import type { HistorianCommit } from "../types";
import { fmt, fmtDate } from "../parse";

export default function CommitTable({
  commits,
  selected,
  onSelect,
}: {
  commits: HistorianCommit[];
  selected: string | null;
  onSelect: (sha: string) => void;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
          <th>commit</th>
          <th>date</th>
          <th>author</th>
          <th>subject</th>
          <th style={{ textAlign: "right" }}>V</th>
          <th style={{ textAlign: "right" }}>E</th>
          <th style={{ textAlign: "right" }}>LOC</th>
          <th style={{ textAlign: "right" }}>CCavg</th>
        </tr>
      </thead>
      <tbody>
        {commits.map((c) => (
          <tr
            key={c.sha}
            onClick={() => onSelect(c.sha)}
            style={{
              cursor: "pointer",
              background: c.sha === selected ? "#eef4ff" : undefined,
              borderBottom: "1px solid #eee",
            }}
          >
            <td><code>{c.sha.slice(0, 8)}</code></td>
            <td>{fmtDate(c.time)}</td>
            <td>{c.author}</td>
            <td>{c.subject}</td>
            <td style={{ textAlign: "right" }}>{fmt(c.commit.verbosity)}</td>
            <td style={{ textAlign: "right" }}>{fmt(c.commit.erosion)}</td>
            <td style={{ textAlign: "right" }}>{c.commit.loc}</td>
            <td style={{ textAlign: "right" }}>{fmt(c.commit.cc_avg, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
