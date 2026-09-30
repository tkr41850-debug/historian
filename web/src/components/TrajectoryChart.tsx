import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsCoreOption } from "echarts/core";
import type { HistorianCommit, RepoId, Selection, XMode } from "../types";
import { repoT0, xLabel, xValue } from "../parse";
import echarts, { axisTipFormatter, fmtY, xAxisOption } from "./echartsSetup";

export interface TrajectoryRepo {
  commits: HistorianCommit[];
  color: string;
  label: string;
  repoId: RepoId;
}

const H = 220;

export default function TrajectoryChart({
  series,
  xMode,
  selected,
  onSelect,
}: {
  series: TrajectoryRepo[];
  xMode: XMode;
  selected: Selection | null;
  onSelect: (repoId: RepoId, sha: string) => void;
}) {
  const total = series.reduce((a, s) => a + s.commits.length, 0);
  const { option, repoIds } = useMemo(() => {
    const perRepo = series.map((r) => {
      const n = r.commits.length;
      const t0 = repoT0(r.commits);
      return {
        repo: r,
        pts: r.commits.map((c, i) => ({
          x: xValue(xMode, i, n, c.time, t0),
          v: c.commit.verbosity,
          e: c.commit.erosion,
          sha: c.sha,
          subject: c.subject,
        })),
      };
    });
    const echSeries = perRepo.flatMap(({ repo, pts }) => {
      const dot = (sha: string, big: number) =>
        selected?.repoId === repo.repoId && selected?.sha === sha
          ? { symbolSize: big, itemStyle: { color: "#123" } }
          : {};
      return [
        {
          name: `${repo.label} · verbosity`,
          type: "line",
          showSymbol: true,
          symbolSize: 5,
          lineStyle: { color: repo.color, width: 2 },
          itemStyle: { color: repo.color },
          emphasis: { focus: "series" },
          data: pts.map((p) => ({
            value: [p.x, p.v],
            sha: p.sha,
            subject: p.subject,
            ...dot(p.sha, 9),
          })),
        },
        {
          name: `${repo.label} · erosion`,
          type: "line",
          showSymbol: true,
          symbolSize: 4,
          lineStyle: { color: repo.color, width: 2, type: "dashed" },
          itemStyle: { color: repo.color },
          emphasis: { focus: "series" },
          data: pts.map((p) => ({
            value: [p.x, p.e],
            sha: p.sha,
            subject: p.subject,
            ...dot(p.sha, 8),
          })),
        },
      ];
    });
    const multi = series.length > 1;
    const opt = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        formatter: axisTipFormatter(xMode, false),
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
        axisLabel: {
          formatter: (v: number | string) => fmtY(Number(v), false),
        },
      },
      series: echSeries,
    } as EChartsCoreOption;
    return {
      option: opt,
      repoIds: perRepo.flatMap(({ repo }) => [repo.repoId, repo.repoId]),
    };
  }, [series, xMode, selected]);
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
      <figcaption
        style={{ fontSize: 12, color: "#666", display: "flex", gap: 10, flexWrap: "wrap" }}
      >
        <span>
          {series.map((r) => (
            <span key={r.repoId}>
              <span style={{ color: r.color }}>●</span> {r.label}{" "}
            </span>
          ))}
        </span>
        <span>— verbosity (solid), erosion (dashed) by {xLabel(xMode)}</span>
        <span>hover for values at x, click a point to select its commit</span>
      </figcaption>
    </figure>
  );
}
