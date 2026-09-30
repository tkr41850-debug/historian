import type { RepoEntry, RepoId } from "../types";

export default function RepoMenu({
  repos,
  visible,
  focusedId,
  onToggle,
  onRemove,
  onFocus,
  onRename,
}: {
  repos: RepoEntry[];
  visible: Set<RepoId>;
  focusedId: RepoId | null;
  onToggle: (id: RepoId) => void;
  onRemove: (id: RepoId) => void;
  onFocus: (id: RepoId) => void;
  onRename: (id: RepoId, label: string) => void;
}) {
  if (repos.length === 0)
    return <p style={{ color: "#666" }}>No repos loaded — drop historian.json files to compare.</p>;
  return (
    <section aria-label="loaded repositories">
      <h2>Repos ({repos.length})</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {repos.map((r) => {
          const n = r.data.commits.length;
          return (
            <li
              key={r.id}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", flexWrap: "wrap" }}
            >
              <span
                aria-hidden
                title={r.color}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: r.color,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <input
                value={r.label}
                onChange={(e) => onRename(r.id, e.target.value)}
                aria-label={`rename repo ${r.filename}`}
                title={r.filename}
                size={Math.max(r.label.length, 4)}
                style={{ padding: "2px 6px" }}
              />
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={visible.has(r.id)}
                  onChange={() => onToggle(r.id)}
                  aria-label={`show ${r.label}`}
                />{" "}
                show
              </label>
              <label style={{ fontSize: 12 }}>
                <input
                  type="radio"
                  name="focused-repo"
                  checked={focusedId === r.id}
                  onChange={() => onFocus(r.id)}
                  aria-label={`focus ${r.label}`}
                />{" "}
                focus
              </label>
              <button onClick={() => onRemove(r.id)} aria-label={`delete ${r.label}`}>
                ×
              </button>
              <span
                style={{
                  fontSize: 12,
                  color: "#666",
                  border: "1px solid #ddd",
                  borderRadius: 999,
                  padding: "0 8px",
                }}
              >
                {n === 1 ? "1 commit" : `${n} commits`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
