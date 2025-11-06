"use client";

import { curveCatmullRom, line as d3Line, max, scaleLinear, scaleTime } from "d3";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { ClusterTweetsPerMonthPoint } from "@/types/cluster";

type NormalizedPoint = {
  key: string;
  date: Date;
  count: number;
};

type HoverState = {
  datum: NormalizedPoint;
  x: number;
  y: number;
  clientX: number;
  clientY: number;
};

const MARGIN = { top: 10, right: 8, bottom: 10, left: 8 } as const;
const MIN_HEIGHT = 24;
const TOOLTIP_WIDTH = 156;
const TOOLTIP_HEIGHT = 60;

type ClusterSparklineProps = {
  data: ClusterTweetsPerMonthPoint[];
};

export const ClusterSparkline = ({ data }: ClusterSparklineProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: MIN_HEIGHT,
  });
  const [hover, setHover] = useState<HoverState | null>(null);

  const points = useMemo<NormalizedPoint[]>(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    const bucket: NormalizedPoint[] = [];
    for (const entry of data) {
      if (!entry) {
        continue;
      }
      const date = new Date(entry.month);
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      const count = Number.isFinite(entry.count) ? Math.max(0, Math.round(entry.count)) : 0;
      bucket.push({
        key: date.toISOString(),
        date,
        count,
      });
    }
    bucket.sort((a, b) => a.date.getTime() - b.date.getTime());
    return bucket;
  }, [data]);

  const width = Math.max(dimensions.width, 0);
  const height = Math.max(dimensions.height, MIN_HEIGHT);
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const hasData = points.length > 0 && innerWidth > 0 && innerHeight > 0;
  const maxCount = useMemo(() => (hasData ? max(points, (point) => point.count) ?? 0 : 0), [hasData, points]);
  const xDomain = useMemo(() => {
    if (!hasData) {
      return null;
    }
    const first = points.at(0)?.date;
    const last = points.at(-1)?.date;
    return first && last ? ([first, last] as const) : null;
  }, [hasData, points]);
  const yDomain = useMemo(() => {
    if (!hasData) {
      return null;
    }
    const upper = Math.max(1, maxCount);
    return [0, upper] as const;
  }, [hasData, maxCount]);

  const xScale = useMemo(() => {
    if (!xDomain) {
      return null;
    }
    return scaleTime().domain(xDomain).range([0, innerWidth]);
  }, [xDomain, innerWidth]);

  const yScale = useMemo(() => {
    if (!yDomain) {
      return null;
    }
    return scaleLinear().domain(yDomain).range([innerHeight, 0]).nice(4);
  }, [innerHeight, yDomain]);
  const scales = useMemo(() => {
    if (!xScale || !yScale) {
      return null;
    }
    return { xScale, yScale };
  }, [xScale, yScale]);

  const linePath = useMemo(() => {
    if (!hasData || !xScale || !yScale) {
      return "";
    }
    const generator = d3Line<NormalizedPoint>()
      .x((point) => xScale(point.date))
      .y((point) => yScale(point.count))
      .curve(curveCatmullRom.alpha(0.5));
    return generator(points) ?? "";
  }, [hasData, points, xScale, yScale]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const nextWidth = node.clientWidth || node.getBoundingClientRect().width || 0;
      const nextHeight = node.clientHeight || node.getBoundingClientRect().height || 0;
      setDimensions((prev) => {
        if (Math.abs(prev.width - nextWidth) < 0.5 && Math.abs(prev.height - nextHeight) < 0.5) {
          return prev;
        }
        return { width: nextWidth, height: nextHeight };
      });
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

    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const resolveNearest = useCallback(
    (time: number): NormalizedPoint | null => {
      if (!hasData) {
        return null;
      }
      let best: NormalizedPoint | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const point of points) {
        const distance = Math.abs(point.date.getTime() - time);
        if (distance < bestDistance) {
          best = point;
          bestDistance = distance;
        }
      }
      return best;
    },
    [hasData, points],
  );

  const formatMonthYear = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }),
    [],
  );
  const formatCount = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }),
    [],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!containerRef.current || !xScale || !yScale || !hasData) {
        return;
      }

      if (event.pointerType === "touch") {
        event.preventDefault();
      }

      const bounds = containerRef.current.getBoundingClientRect();
      const localX = event.clientX - bounds.left;
      const clampedX = Math.max(MARGIN.left, Math.min(width - MARGIN.right, localX));
      const relativeX = clampedX - MARGIN.left;
      const clampedRelativeX = Math.max(0, Math.min(innerWidth, relativeX));
      const hoveredDate = xScale.invert(clampedRelativeX);
      const nearest = resolveNearest(hoveredDate.getTime());
      if (!nearest) {
        setHover(null);
        return;
      }
      const x = MARGIN.left + xScale(nearest.date);
      const y = MARGIN.top + yScale(nearest.count);
      setHover({ datum: nearest, x, y, clientX: event.clientX, clientY: event.clientY });
    },
    [hasData, innerWidth, resolveNearest, width, xScale, yScale],
  );

  const handlePointerLeave = useCallback(() => {
    setHover(null);
  }, []);

  const tooltipStyle = useMemo(() => {
    if (!hover || typeof window === "undefined") {
      return undefined;
    }
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const offset = 16;
    const rawLeft = hover.clientX + offset;
    const rawTop = hover.clientY + offset;
    const left = Math.min(Math.max(8, rawLeft), Math.max(8, viewportWidth - TOOLTIP_WIDTH - 8));
    const top = Math.min(Math.max(8, rawTop), Math.max(8, viewportHeight - TOOLTIP_HEIGHT - 8));
    return { left, top };
  }, [hover]);

  return (
    <div
      ref={containerRef}
      className="group relative h-full w-full text-zinc-800 transition-colors dark:text-zinc-100"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ touchAction: "none" }}
    >
      {!hasData ? (
        <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-zinc-300 text-[0.7rem] text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
          No data
        </div>
      ) : (
        <>
          <svg
            className="h-full w-full"
            viewBox={`0 0 ${width || 1} ${height || 1}`}
            aria-hidden="true"
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              <rect
                width={innerWidth}
                height={innerHeight}
                className="fill-transparent"
                rx={4}
                ry={4}
              />
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="opacity-85"
              />
              {hover && scales ? (
                <>
                  <line
                    x1={scales.xScale(hover.datum.date)}
                    x2={scales.xScale(hover.datum.date)}
                    y1={0}
                    y2={innerHeight}
                    stroke="currentColor"
                    strokeWidth={1}
                    strokeDasharray="2,2"
                    className="opacity-70"
                  />
                  <circle
                    cx={scales.xScale(hover.datum.date)}
                    cy={scales.yScale(hover.datum.count)}
                    r={3}
                    fill="currentColor"
                    className="opacity-90"
                  />
                </>
              ) : null}
            </g>
          </svg>
          {hover && tooltipStyle && typeof document !== "undefined"
            ? createPortal(
                <div
                  className="pointer-events-none fixed z-[1000] rounded-md bg-white/95 px-3 py-2 text-[0.7rem] leading-tight shadow-lg ring-1 ring-zinc-200 transition dark:bg-zinc-900/95 dark:ring-zinc-700"
                  style={tooltipStyle}
                >
                  <div className="font-medium text-zinc-700 dark:text-zinc-100">
                    {formatMonthYear.format(hover.datum.date)}
                  </div>
                  <div className="text-zinc-500 dark:text-zinc-400">
                    {formatCount.format(hover.datum.count)} tweets
                  </div>
                </div>,
                document.body,
              )
            : null}
        </>
      )}
    </div>
  );
};
