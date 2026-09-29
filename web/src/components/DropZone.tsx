import { useRef, useState } from "react";

export default function DropZone({
  onFile,
  error,
}: {
  onFile: (f: File) => void;
  error?: string | null;
}) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
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
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Load historian.json: drop a file here or press Enter to browse"
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
        Drop <code>historian.json</code> here, or click to browse
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
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
