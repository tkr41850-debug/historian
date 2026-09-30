import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  AxisPointerComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { fmt, fmtDate, xLabel } from "../parse";
import type { XMode } from "../types";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  LegendComponent,
  CanvasRenderer,
]);

export default echarts;

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
}

/** Y values: loc/functions are integral, the rest use fmt(). */
export function fmtY(v: number, integral: boolean): string {
  if (!Number.isFinite(v)) return "—";
  return integral ? String(Math.round(v)) : fmt(v);
}

function humanDur(s: number): string {
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${(s / 60).toFixed(1)}m`;
  if (s < 172800) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

/** Human-readable x for tooltips, per x-mode. */
export function formatX(mode: XMode, v: number): string {
  if (!Number.isFinite(v)) return "—";
  switch (mode) {
    case "time-abs":
      return fmtDate(v);
    case "time-rel":
      return `${humanDur(v)} after start`;
    case "commit-abs":
      return `commit #${Math.round(v)}`;
    case "commit-rel":
      return `${(v * 100).toFixed(1)}% through`;
  }
}

/** Value x-axis config per x-mode (dates, integer commits, %). */
export function xAxisOption(mode: XMode) {
  const base = {
    type: "value" as const,
    name: xLabel(mode),
    nameLocation: "middle" as const,
    nameGap: 24,
  };
  switch (mode) {
    case "time-abs":
      return {
        ...base,
        axisLabel: { formatter: (v: number | string) => fmtDate(Number(v)) },
      };
    case "time-rel":
      return {
        ...base,
        axisLabel: { formatter: (v: number | string) => humanDur(Number(v)) },
      };
    case "commit-abs":
      return { ...base, minInterval: 1 };
    case "commit-rel":
      return {
        ...base,
        min: 0,
        max: 1,
        axisLabel: {
          formatter: (v: number | string) => `${Math.round(Number(v) * 100)}%`,
        },
      };
  }
}

interface TipPoint {
  marker?: string;
  seriesName?: string;
  value?: unknown;
  data?: { sha?: string; subject?: string } | null;
}

/**
 * Axis-triggered tooltip: every repo's value at the hovered x
 * (Datadog-style crosshair readout), with short sha + subject.
 */
export function axisTipFormatter(
  xMode: XMode,
  integral: boolean,
): (params: unknown) => string {
  return (params: unknown): string => {
    const arr = (Array.isArray(params) ? params : [params]) as TipPoint[];
    if (arr.length === 0) return "";
    const raw = arr[0]?.value;
    const x = Array.isArray(raw) ? Number(raw[0]) : Number(raw);
    const lines = arr.map((p) => {
      const y = Array.isArray(p.value) ? Number(p.value[1]) : NaN;
      const sha =
        typeof p.data?.sha === "string" ? p.data.sha.slice(0, 8) : "";
      const subj =
        typeof p.data?.subject === "string" && p.data.subject
          ? ` ${escapeHtml(p.data.subject)}`
          : "";
      return `${p.marker ?? ""} ${escapeHtml(p.seriesName ?? "")}: <b>${fmtY(y, integral)}</b> <span style="color:#999">${escapeHtml(sha)}</span>${subj}`;
    });
    return `<b>${escapeHtml(formatX(xMode, x))}</b><br/>${lines.join("<br/>")}`;
  };
}
