import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export default function Tex({ math, block = false }: { math: string; block?: boolean }) {
  const html = useMemo(
    () =>
      katex.renderToString(math, {
        throwOnError: false,
        displayMode: block,
        strict: false,
      }),
    [math, block],
  );
  return block ? (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}
