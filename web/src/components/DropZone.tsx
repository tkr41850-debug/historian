import { useRef, useState } from "react";

export default function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
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
        }}
      />
    </div>
  );
}
