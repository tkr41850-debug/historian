import type { Filters } from "../parse";

export default function Filters({
  value,
  authors,
  onChange,
  count,
}: {
  value: Filters;
  authors: string[];
  onChange: (f: Filters) => void;
  count: string;
}) {
  const set = (k: keyof Filters, v: string) => onChange({ ...value, [k]: v });
  const input: React.CSSProperties = { marginRight: 8, padding: "4px 8px" };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "12px 0" }}>
      <select value={value.author} onChange={(e) => set("author", e.target.value)} style={input} aria-label="author filter">
        <option value="">all authors</option>
        {authors.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
      <input value={value.search} onChange={(e) => set("search", e.target.value)} placeholder="search subject/body/sha" size={28} style={input} aria-label="search filter" />
      <input type="date" value={value.from} onChange={(e) => set("from", e.target.value)} style={input} aria-label="from date" />
      <span>→</span>
      <input type="date" value={value.to} onChange={(e) => set("to", e.target.value)} style={input} aria-label="to date" />
      {(value.author || value.search || value.from || value.to) && (
        <button onClick={() => onChange({ author: "", search: "", from: "", to: "" })}>clear</button>
      )}
      <span style={{ marginLeft: "auto", color: "#666", fontSize: 12 }}>{count}</span>
    </div>
  );
}
