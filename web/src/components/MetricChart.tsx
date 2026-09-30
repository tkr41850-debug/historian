import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsCoreOption } from "echarts/core";
import type {
  MetricKey,
  OverlaySeries,
  RepoId,
  Selection,
  XMode,
} from "../types";
import { METRICS, xLabel } from "../parse";
import echarts, { axisTipFormatter, fmtY, xAxisOption } from "./echartsSetup";

const INTEGRAL: ReadonlySet<MetricKey> = new Set(["loc", "functions"]);

export default function MetricChart({
  series,
  xMode,
  metric,
  height = 220,
  selection,
  onSelect,
}: {
  series: OverlaySeries[];
  xMode: XMode;
  metric: MetricKey;
  height?: number;
  selection: Selection | null;
  onSelect: (repoId: RepoId, sha: string) => void;
}) {
  const total = series.reduce((a, s) => a + s.points.length, 0);
  const label = METRICS.find((m) => m.key === metric)?.label ?? metric;
  const integral = INTEGRAL.has(metric);
  const H = Math.max(height, 160);
  const multi = series.length > 1;
  const { option, repoIds } = useMemo(() => {
    const opt = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: axisTipFormatter(xMode, integral),
      },
      legend: {
        show: multi,
        type: "scroll",
        textStyle: { fontSize: 11 },
      },
      grid: { left: 52, right: 16, top: multi ? 34 : 12, bottom: 30 },
      xAxis: xAxisOption(xMode),
      yAxis: {
        type: "value",
        ...(integral ? { minInterval: 1 } : {}),
        axisLabel: {
          formatter: (v: number | string) => fmtY(Number(v), integral),
        },
      },
      series: series.map((s) => ({
        name: s.label,
        type: "line",
        showSymbol: true,
        symbolSize: 6,
        lineStyle: { color: s.color, width: 2 },
        itemStyle: { color: s.color },
        emphasis: { focus: "series" },
        data: s.points.map((p) =>
          selection?.repoId === s.repoId && selection?.sha === p.sha
            ? {
                value: [p.x, p.y],
                sha: p.sha,
                symbolSize: 10,
                itemStyle: { color: "#123" },
              }
            : { value: [p.x, p.y], sha: p.sha },
        ),
      })),
    } as EChartsCoreOption;
    return { option: opt, repoIds: series.map((s) => s.repoId) };
  }, [series, xMode, integral, multi, selection]);
  const onEvents = useMemo(
    () => ({
      click: (p: { seriesIndex?: number; data?: { sha?: string } }) => {
        const repoId =
          p.seriesIndex != null ? repoIds[p.seriesIndex] : undefined;
        const sha = p.data?.sha;
        if (repoId !== undefined && sha) onSelect(repoId, sha);
      },
    }),
    [repoIds, onSelect],
  );
  if (total === 0) return <p>No commits to chart.</p>;
  return (
    <figure style={{ margin: 0 }}>
      <ReactECharts
        echarts={echarts}
        option={option}
        style={{ height: H }}
        onEvents={onEvents}
        notMerge
        lazyUpdate
      />
      <figcaption style={{ fontSize: 12, color: "#666" }}>
        {label} by {xLabel(xMode)} — hover for values at x, click a point to
        select its commit
      </figcaption>
    </figure>
  );
}
