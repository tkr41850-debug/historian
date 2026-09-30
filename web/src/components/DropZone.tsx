import { useRef, useState } from "react";

export default function DropZone({
  onFiles,
  error,
}: {
  onFiles: (fs: File[]) => void;
  error?: string | null;
}) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pick = (list: FileList | null | undefined) => {
    if (!list) return;
    const fs = Array.from(list);
    if (fs.length > 0) onFiles(fs);
  };
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Load historian.json files: drop files here or press Enter to browse"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") input.current?.click();
        }}
        style={{
          border: `2px dashed ${drag ? "#4f8cff" : "#888"}`,
          borderRadius: 8,
          padding: "18px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: drag ? "#eef4ff" : "#fafafa",
        }}
      >
        Drop <code>historian.json</code> files here — one or many — or click to browse
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          multiple
          hidden
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" style={{ color: "#b00020", fontSize: 13 }}>
          {error}
        </p>
      )}
    </div>
  );
}
