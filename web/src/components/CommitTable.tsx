import { useEffect, useState } from "react";
import type { HistorianCommit } from "../types";
import { fmt, fmtDate, sortCommits, type SortKey } from "../parse";

const COLS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "index", label: "#" },
  { key: "sha", label: "commit" },
  { key: "date", label: "date" },
  { key: "author", label: "author" },
  { key: "subject", label: "subject" },
  { key: "verbosity", label: "V", right: true },
  { key: "erosion", label: "E", right: true },
  { key: "loc", label: "LOC", right: true },
  { key: "cc_avg", label: "CCavg", right: true },
];

export default function CommitTable({
  commits,
  selected,
  onSelect,
  caption,
}: {
  commits: HistorianCommit[];
  selected: string | null;
  onSelect: (sha: string | null) => void;
  caption?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("index");
  const [dir, setDir] = useState<1 | -1>(1);
  const [selIdx, setSelIdx] = useState(0);

  const rows = sortCommits(commits, sortKey, dir);

  useEffect(() => setSelIdx(0), [commits, sortKey, dir]);

  if (commits.length === 0)
    return <p style={{ color: "#666" }}>No commits match the current filters.</p>;

  const toggle = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setDir(1);
    }
  };

  return (
    <div style={{ overflowX: "auto" }}>
      {caption != null && caption !== "" && (
        <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>{caption}</p>
      )}
      <table
        className="ctable"
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        aria-label="commits"
      >
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
            {COLS.map((c) => (
              <th
                key={c.key}
                style={{ textAlign: c.right ? "right" : "left", whiteSpace: "nowrap" }}
              >
                <button
                  onClick={() => toggle(c.key)}
                  aria-label={`sort by ${c.label}`}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 2,
                    font: "inherit",
                    fontWeight: c.key === sortKey ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {c.label}
                  {c.key === sortKey ? (dir === 1 ? " ▲" : " ▼") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          tabIndex={0}
          aria-label="commit rows: arrow keys move, Enter opens detail"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setSelIdx((i) =>
                e.key === "ArrowDown"
                  ? Math.min(i + 1, rows.length - 1)
                  : Math.max(i - 1, 0),
              );
            } else if (e.key === "Enter") {
              onSelect(rows[selIdx]?.sha ?? null);
            }
          }}
        >
          {rows.map((c, i) => (
            <tr
              key={`${c.sha}#${i}`}
              onClick={() => onSelect(c.sha)}
              style={{
                cursor: "pointer",
                background:
                  c.sha === selected
                    ? "#eef4ff"
                    : i === selIdx
                      ? "#f6f6f6"
                      : undefined,
                borderBottom: "1px solid #eee",
              }}
            >
              <td title={`chronological #${i + 1}`} className="num">{i + 1}</td>
              <td>
                {c.permalink ? (
                  <a
                    href={c.permalink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <code>{c.sha.slice(0, 8)}</code>
                  </a>
                ) : (
                  <code>{c.sha.slice(0, 8)}</code>
                )}
              </td>
              <td style={{ whiteSpace: "nowrap" }}>{fmtDate(c.time)}</td>
              <td>{c.author}</td>
              <td>{c.subject}</td>
              <td style={{ textAlign: "right" }} className="num">{fmt(c.commit.verbosity)}</td>
              <td style={{ textAlign: "right" }} className="num">{fmt(c.commit.erosion)}</td>
              <td style={{ textAlign: "right" }} className="num">{c.commit.loc}</td>
              <td style={{ textAlign: "right" }} className="num">{fmt(c.commit.cc_avg, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
