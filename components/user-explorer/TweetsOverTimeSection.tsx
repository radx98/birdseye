"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { max, scaleBand, scaleLinear, timeFormat } from "d3";
import { useUserExplorer } from "./context";

const CHART_MARGIN = {
  top: 20,
  right: 24,
  bottom: 68,
  left: 64,
} as const;
const MAX_X_TICKS = 12;
const MAX_BAR_WIDTH = 32;
const DEFAULT_HEIGHT = 320;
const MINIMUM_WIDTH = CHART_MARGIN.left + CHART_MARGIN.right + 16;
const TOOLTIP_WIDTH = 180;
const TOOLTIP_HEIGHT = 64;

type TimelineDatum = {
  key: string;
  date: Date;
  count: number;
};

export const TweetsOverTimeSection = () => {
  const { summary, expandLoading } = useUserExplorer();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState<{ datum: TimelineDatum; x: number; y: number } | null>(null);

  const formatTooltipMonth = useMemo(() => timeFormat("%B"), []);
  const formatTooltipYear = useMemo(() => timeFormat("%Y"), []);

  const timelineData = useMemo<TimelineDatum[]>(() => {
    const source = summary?.tweetsOverTime ?? [];
    return source
      .map((entry) => {
        const date = new Date(entry.month);
        if (Number.isNaN(date.getTime())) {
          return null;
        }
        const count = Number.isFinite(entry.count) ? Math.max(0, Math.round(entry.count)) : 0;
        return {
          key: date.toISOString(),
          date,
          count,
        };
      })
      .filter((value): value is TimelineDatum => value !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [summary?.tweetsOverTime]);

  const chartWidth = containerWidth > 0 ? containerWidth : MINIMUM_WIDTH;
  const chartHeight = DEFAULT_HEIGHT;

  const hasData = timelineData.length > 0;
  const showLoading = expandLoading && !hasData;
  const hasChart = hasData && !showLoading;

  useEffect(() => {
    if (!hasChart) {
      const frame = requestAnimationFrame(() => {
        setTooltip(null);
      });
      return () => cancelAnimationFrame(frame);
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const width = node.clientWidth || node.getBoundingClientRect().width || 0;
      setContainerWidth((prev) => (Math.abs(prev - width) < 0.5 ? prev : width));
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      if (typeof window !== "undefined") {
        window.addEventListener("resize", measure);
        return () => {
          window.removeEventListener("resize", measure);
        };
      }
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === node) {
          const width = entry.contentRect?.width ?? node.clientWidth ?? 0;
          setContainerWidth((prev) => (Math.abs(prev - width) < 0.5 ? prev : width));
          break;
        }
      }
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [hasChart]);

  const xScale = useMemo(() => {
    const scale = scaleBand<string>()
      .domain(timelineData.map((datum) => datum.key))
      .range([CHART_MARGIN.left, Math.max(CHART_MARGIN.left, chartWidth - CHART_MARGIN.right)])
      .paddingInner(0.2)
      .paddingOuter(0.3);
    return scale;
  }, [timelineData, chartWidth]);

  const maxCount = useMemo(() => max(timelineData, (datum) => datum.count) ?? 0, [timelineData]);

  const yScale = useMemo(() => {
    const upper = maxCount > 0 ? maxCount : 1;
    const scale = scaleLinear()
      .domain([0, upper])
      .range([chartHeight - CHART_MARGIN.bottom, CHART_MARGIN.top]);
    scale.nice();
    return scale;
  }, [maxCount, chartHeight]);

  const baseline = Number.isFinite(yScale(0)) ? yScale(0) : chartHeight - CHART_MARGIN.bottom;
  const yTicks = useMemo(() => {
    const ticks = yScale.ticks(4);
    return ticks.filter((tick) => tick >= 0);
  }, [yScale]);

  const xTicks = useMemo(() => {
    if (!timelineData.length) {
      return [] as TimelineDatum[];
    }

    const anchors: TimelineDatum[] = [];
    const seenYears = new Set<number>();

    for (const datum of timelineData) {
      const year = datum.date.getUTCFullYear();
      const month = datum.date.getUTCMonth();
      if (month === 0 && !seenYears.has(year)) {
        anchors.push(datum);
        seenYears.add(year);
      }
    }

    if (anchors.length <= 1) {
      return anchors;
    }

    const availableWidth = Math.max(1, chartWidth - CHART_MARGIN.left - CHART_MARGIN.right);
    const capacity = Math.max(1, Math.floor(availableWidth / 80));
    const tickLimit = Math.max(1, Math.min(MAX_X_TICKS, capacity));

    if (anchors.length <= tickLimit) {
      return anchors;
    }

    const step = Math.max(1, Math.ceil(anchors.length / tickLimit));
    const filtered: TimelineDatum[] = [];
    for (let index = 0; index < anchors.length; index += step) {
      filtered.push(anchors[index]);
    }
    const last = anchors[anchors.length - 1];
    if (!filtered.some((entry) => entry.key === last.key)) {
      filtered.push(last);
    }
    return filtered;
  }, [timelineData, chartWidth]);

  const clamp = (value: number, min: number, max: number) => {
    if (max <= min) {
      return min;
    }
    return Math.min(Math.max(value, min), max);
  };

  const handlePointerMove = (event: MouseEvent<SVGRectElement>, datum: TimelineDatum) => {
    const host = containerRef.current;
    if (!host) {
      return;
    }
    const bounds = host.getBoundingClientRect();
    const desiredX = event.clientX - bounds.left + 12;
    const desiredY = event.clientY - bounds.top - TOOLTIP_HEIGHT;
    const maxLeft = bounds.width - TOOLTIP_WIDTH - 8;
    const clampedX = clamp(desiredX, CHART_MARGIN.left, maxLeft);
    const clampedY = clamp(desiredY, CHART_MARGIN.top, bounds.height - TOOLTIP_HEIGHT - 8);
    setTooltip({ datum, x: clampedX, y: clampedY });
  };

  const handlePointerLeave = () => {
    setTooltip(null);
  };

  if (!summary) {
    return null;
  }

  let body: ReactNode = null;

  if (showLoading) {
    body = (
      <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
          Loading...
        </span>
      </div>
    );
  } else if (!hasData) {
    body = (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        No tweet history is available yet.
      </div>
    );
  } else {
    body = (
      <div
        ref={containerRef}
        className="relative w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60"
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="Monthly tweet volume bar chart"
          width={chartWidth}
          height={chartHeight}
          className="block"
        >
          <g aria-hidden="true" className="stroke-zinc-200 dark:stroke-zinc-700">
            {yTicks.map((tick) => {
              const y = yScale(tick);
              return (
                <line
                  key={`grid-${tick}`}
                  x1={CHART_MARGIN.left}
                  x2={Math.max(CHART_MARGIN.left, chartWidth - CHART_MARGIN.right)}
                  y1={y}
                  y2={y}
                  strokeDasharray="2 4"
                />
              );
            })}
            <line
              x1={CHART_MARGIN.left}
              x2={Math.max(CHART_MARGIN.left, chartWidth - CHART_MARGIN.right)}
              y1={baseline}
              y2={baseline}
              className="stroke-zinc-300 dark:stroke-zinc-600"
            />
          </g>

          <g aria-hidden="true">
            {timelineData.map((datum) => {
              const x = xScale(datum.key);
              if (typeof x !== "number") {
                return null;
              }
              const y = yScale(datum.count);
              const height = baseline - y;
              const fullWidth = xScale.bandwidth();
              const clampedWidth = Math.max(2, Math.min(fullWidth, MAX_BAR_WIDTH));
              const offsetX = x + (fullWidth - clampedWidth) / 2;

              return (
                <rect
                  key={datum.key}
                  x={offsetX}
                  y={y}
                  width={clampedWidth}
                  height={height < 0 ? 0 : height}
                  className="fill-zinc-900/80 transition-colors hover:fill-zinc-900 dark:fill-zinc-100/60 dark:hover:fill-zinc-100"
                  onMouseEnter={(event) => handlePointerMove(event, datum)}
                  onMouseMove={(event) => handlePointerMove(event, datum)}
                  onMouseLeave={handlePointerLeave}
                  aria-label={`${formatTooltipMonth(datum.date)} ${formatTooltipYear(datum.date)}: ${datum.count.toLocaleString()} tweets`}
                >
                </rect>
              );
            })}
          </g>

          <g aria-hidden="true" className="text-xs font-medium fill-zinc-500 dark:fill-zinc-300">
            {yTicks.map((tick) => {
              const y = yScale(tick);
              return (
                <text key={`label-y-${tick}`} x={CHART_MARGIN.left - 12} y={y} dominantBaseline="middle" textAnchor="end">
                  {tick.toLocaleString()}
                </text>
              );
            })}
          </g>

          <g aria-hidden="true" className="text-xs fill-zinc-500 dark:fill-zinc-300">
            {xTicks.map((tick) => {
              const x = xScale(tick.key);
              if (typeof x !== "number") {
                return null;
              }
              const bandWidth = xScale.bandwidth();
              const clampedWidth = Math.max(2, Math.min(bandWidth, MAX_BAR_WIDTH));
              const labelX = x + (bandWidth - clampedWidth) / 2 + clampedWidth;
              return (
                <g key={`label-x-${tick.key}`} transform={`translate(${labelX}, ${baseline})`}>
                  <text textAnchor="start" dy="1.6em">
                    {tick.date.getUTCFullYear()}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {tooltip && (
          <div
            className="pointer-events-none absolute rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-lg transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            style={{ left: tooltip.x, top: tooltip.y, width: TOOLTIP_WIDTH }}
          >
            <div className="text-zinc-900 dark:text-white">{formatTooltipMonth(tooltip.datum.date)}</div>
            <div className="text-zinc-500 dark:text-zinc-300">{formatTooltipYear(tooltip.datum.date)}</div>
            <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
              {tooltip.datum.count.toLocaleString()} tweet{tooltip.datum.count === 1 ? "" : "s"}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div>
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
          Tweets over time
        </h2>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
        <span role="img" aria-hidden="true" className="mr-2">
          📈
        </span>
        Drag horizontally on the graph to filter tweets in the right column.
      </div>
      {body}
    </section>
  );
};
