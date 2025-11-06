"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { max, scaleBand, scaleLinear, timeFormat } from "d3";
import { useUserExplorer, type TimelineRange } from "./context";

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
const DOUBLE_TAP_MS = 300;

type TimelineDatum = {
  key: string;
  date: Date;
  count: number;
};

export const TweetsOverTimeSection = () => {
  const { summary, expandLoading, timelineRange, setTimelineRange } = useUserExplorer();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rangeTrackRef = useRef<HTMLDivElement | null>(null);
  type RangeDragState =
    | { pointerId: number; type: "start" | "end"; handle: HTMLButtonElement | null }
    | {
        pointerId: number;
        type: "range";
        originIndex: number;
        baseStartIndex: number;
        baseEndIndex: number;
        target: HTMLDivElement | null;
      };

  const rangeDragRef = useRef<RangeDragState | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState<{ datum: TimelineDatum; x: number; y: number } | null>(null);
  const [dragRange, setDragRange] = useState<{ anchorKey: string; currentKey: string } | null>(null);
  const [viewportRangeState, setViewportRangeState] = useState<TimelineRange | null>(null);
  const [isRangeDragging, setIsRangeDragging] = useState(false);
  const [maxAvailableWidth, setMaxAvailableWidth] = useState(0);
  const activePointerIdRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ start: number; end: number; range: number }>({
    start: 0,
    end: 0,
    range: 0,
  });
  const DOUBLE_TAP_MS = 300;

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

  const indexByKeyAll = useMemo(() => {
    const map = new Map<string, number>();
    timelineData.forEach((datum, index) => {
      map.set(datum.key, index);
    });
    return map;
  }, [timelineData]);

  const chartWidth = containerWidth > 0 ? containerWidth : MINIMUM_WIDTH;
  const chartHeight = DEFAULT_HEIGHT;
  const availableChartWidth = Math.max(0, chartWidth - CHART_MARGIN.left - CHART_MARGIN.right);

  const defaultVisibleCount = useMemo(() => {
    if (!timelineData.length) {
      return 0;
    }
    const baselineWidth = maxAvailableWidth > 0 ? maxAvailableWidth : availableChartWidth;
    if (baselineWidth <= 0) {
      return timelineData.length;
    }
    const density = timelineData.length / baselineWidth;
    const desired = Math.round(density * availableChartWidth);
    return Math.max(1, Math.min(timelineData.length, desired || 1));
  }, [timelineData, availableChartWidth, maxAvailableWidth]);

  const resolvedViewportRange = useMemo(() => {
    if (!timelineData.length) {
      return null;
    }
    const total = timelineData.length;
    const lastIndex = total - 1;
    const defaultCount = Math.max(1, Math.min(total, defaultVisibleCount || total));

    let startIndex: number | null = null;
    let endIndex: number | null = null;

    if (viewportRangeState) {
      const rawStart = indexByKeyAll.get(viewportRangeState.start);
      const rawEnd = indexByKeyAll.get(viewportRangeState.end);
      if (rawStart !== undefined && rawEnd !== undefined) {
        startIndex = Math.min(rawStart, rawEnd);
        endIndex = Math.max(rawStart, rawEnd);
      }
    }

    if (startIndex === null || endIndex === null) {
      endIndex = lastIndex;
      startIndex = Math.max(0, lastIndex - (defaultCount - 1));
    }

    startIndex = Math.max(0, Math.min(startIndex, lastIndex));
    endIndex = Math.max(startIndex, Math.min(endIndex, lastIndex));

    const startKey = timelineData[startIndex]?.key;
    const endKey = timelineData[endIndex]?.key;
    if (!startKey || !endKey) {
      return null;
    }
    return { start: startKey, end: endKey };
  }, [timelineData, viewportRangeState, indexByKeyAll, defaultVisibleCount]);

  const resolvedStartIndex = resolvedViewportRange
    ? indexByKeyAll.get(resolvedViewportRange.start) ?? 0
    : 0;
  const resolvedEndIndex = resolvedViewportRange
    ? indexByKeyAll.get(resolvedViewportRange.end) ?? Math.max(0, timelineData.length - 1)
    : Math.max(0, timelineData.length - 1);

  const renderData = useMemo(() => {
    if (!timelineData.length) {
      return [] as TimelineDatum[];
    }
    const start = Math.max(0, Math.min(resolvedStartIndex, timelineData.length - 1));
    const end = Math.max(start, Math.min(resolvedEndIndex, timelineData.length - 1));
    return timelineData.slice(start, end + 1);
  }, [timelineData, resolvedStartIndex, resolvedEndIndex]);

  const hasTimeline = timelineData.length > 0;
  const showLoading = expandLoading && !hasTimeline;
  const hasChart = renderData.length > 0 && !showLoading;

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
      const availableWidth = Math.max(0, width - CHART_MARGIN.left - CHART_MARGIN.right);
      setMaxAvailableWidth((prev) => (availableWidth > prev ? availableWidth : prev));
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
          const availableWidth = Math.max(0, width - CHART_MARGIN.left - CHART_MARGIN.right);
          setMaxAvailableWidth((prev) => (availableWidth > prev ? availableWidth : prev));
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
      .domain(renderData.map((datum) => datum.key))
      .range([CHART_MARGIN.left, Math.max(CHART_MARGIN.left, chartWidth - CHART_MARGIN.right)])
      .paddingInner(0.2)
      .paddingOuter(0.3);
    return scale;
  }, [renderData, chartWidth]);

  const barLayout = useMemo(() => {
    const layout = new Map<
      string,
      {
        offsetX: number;
        width: number;
        center: number;
      }
    >();

    for (const datum of renderData) {
      const position = xScale(datum.key);
      if (typeof position !== "number") {
        continue;
      }
      const fullWidth = xScale.bandwidth();
      const clampedWidth = Math.max(2, Math.min(fullWidth, MAX_BAR_WIDTH));
      const offsetX = position + (fullWidth - clampedWidth) / 2;
      layout.set(datum.key, {
        offsetX,
        width: clampedWidth,
        center: offsetX + clampedWidth / 2,
      });
    }

    return layout;
  }, [renderData, xScale]);

  const maxCount = useMemo(() => max(renderData, (datum) => datum.count) ?? 0, [renderData]);

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
    if (!renderData.length) {
      return [] as TimelineDatum[];
    }

    const anchors: TimelineDatum[] = [];
    const seenYears = new Set<number>();

    for (const datum of renderData) {
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
  }, [renderData, chartWidth]);

  const clamp = (value: number, min: number, max: number) => {
    if (max <= min) {
      return min;
    }
    return Math.min(Math.max(value, min), max);
  };

  const collectKeysBetween = useCallback(
    (startKey: string, endKey: string) => {
      const startIndex = indexByKeyAll.get(startKey);
      const endIndex = indexByKeyAll.get(endKey);
      if (startIndex === undefined || endIndex === undefined) {
        return [] as string[];
      }
      const lower = Math.min(startIndex, endIndex);
      const upper = Math.max(startIndex, endIndex);
      const keys: string[] = [];
      for (let index = lower; index <= upper; index += 1) {
        const entry = timelineData[index];
        if (entry) {
          keys.push(entry.key);
        }
      }
      return keys;
    },
    [indexByKeyAll, timelineData],
  );

  const resolvePointerKey = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const node = svgRef.current;
      if (!node) {
        return null;
      }
      const bounds = node.getBoundingClientRect();
      const xPosition = event.clientX - bounds.left;
      let closestKey: string | null = null;
      let smallestDistance = Number.POSITIVE_INFINITY;

      for (const [key, info] of barLayout.entries()) {
        const distance = Math.abs(xPosition - info.center);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          closestKey = key;
        }
      }

      return closestKey;
    },
    [barLayout],
  );

  const normalizeRange = useCallback(
    (range: { anchorKey: string; currentKey: string } | null) => {
      if (!range) {
        return null;
      }
      const keys = collectKeysBetween(range.anchorKey, range.currentKey);
      if (!keys.length) {
        return null;
      }
      return {
        start: keys[0],
        end: keys[keys.length - 1],
      } satisfies TimelineRange;
    },
    [collectKeysBetween],
  );

  const activeSelectionRange = useMemo(() => {
    if (dragRange) {
      return normalizeRange(dragRange);
    }
    return timelineRange;
  }, [dragRange, timelineRange, normalizeRange]);

  const selectionKeys = useMemo(() => {
    if (!activeSelectionRange) {
      return new Set<string>();
    }
    return new Set(collectKeysBetween(activeSelectionRange.start, activeSelectionRange.end));
  }, [activeSelectionRange, collectKeysBetween]);

  const selectionActive = selectionKeys.size > 0;

  const selectionLabel = useMemo(() => {
    if (!activeSelectionRange) {
      return null;
    }
    const startDate = new Date(activeSelectionRange.start);
    const endDate = new Date(activeSelectionRange.end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return null;
    }
    const startLabel = `${formatTooltipMonth(startDate)} ${formatTooltipYear(startDate)}`;
    const endLabel = `${formatTooltipMonth(endDate)} ${formatTooltipYear(endDate)}`;
    if (startLabel === endLabel) {
      return startLabel;
    }
    return `${startLabel} – ${endLabel}`;
  }, [activeSelectionRange, formatTooltipMonth, formatTooltipYear]);

  const totalSteps = Math.max(0, timelineData.length - 1);
  const sliderLeft = CHART_MARGIN.left;
  const sliderWidth = availableChartWidth;
  const startRatio = totalSteps > 0 ? resolvedStartIndex / totalSteps : 0;
  const endRatio = totalSteps > 0 ? resolvedEndIndex / totalSteps : 0;
  const startHandleLeft = sliderLeft + sliderWidth * startRatio;
  const endHandleLeft = sliderLeft + sliderWidth * endRatio;
  const highlightLeft = Math.min(startHandleLeft, endHandleLeft);
  const highlightRight = Math.max(startHandleLeft, endHandleLeft);
  const minHighlightWidth =
    sliderWidth > 0
      ? Math.max(sliderWidth / Math.max(1, timelineData.length), 6)
      : 0;
  const highlightWidthRaw =
    sliderWidth > 0 ? Math.max(minHighlightWidth, highlightRight - highlightLeft) : 0;
  const highlightWidth = sliderWidth > 0 ? Math.min(sliderWidth, highlightWidthRaw) : 0;
  const sliderDisabled = timelineData.length <= 1;

  const viewportLabelStart = useMemo(() => {
    if (!resolvedViewportRange) {
      return null;
    }
    const date = new Date(resolvedViewportRange.start);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return `${formatTooltipMonth(date)} ${formatTooltipYear(date)}`;
  }, [resolvedViewportRange, formatTooltipMonth, formatTooltipYear]);

  const viewportLabelEnd = useMemo(() => {
    if (!resolvedViewportRange) {
      return null;
    }
    const date = new Date(resolvedViewportRange.end);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return `${formatTooltipMonth(date)} ${formatTooltipYear(date)}`;
  }, [resolvedViewportRange, formatTooltipMonth, formatTooltipYear]);

  const pointerPositionToIndex = useCallback(
    (clientX: number) => {
      const trackNode = rangeTrackRef.current;
      if (!trackNode || !timelineData.length) {
        return null;
      }
      const bounds = trackNode.getBoundingClientRect();
      const width = bounds.width;
      if (width <= 0) {
        return null;
      }
      const ratio = clamp((clientX - bounds.left) / width, 0, 1);
      const maxIndex = timelineData.length - 1;
      if (maxIndex === 0) {
        return 0;
      }
      return Math.round(ratio * maxIndex);
    },
    [timelineData.length],
  );

  const applyViewportIndices = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!timelineData.length) {
        return;
      }
      const total = timelineData.length;
      const maxIndex = total - 1;
      const safeStart = Math.max(0, Math.min(startIndex, maxIndex));
      const safeEnd = Math.max(safeStart, Math.min(endIndex, maxIndex));
      const startKey = timelineData[safeStart]?.key;
      const endKey = timelineData[safeEnd]?.key;
      if (!startKey || !endKey) {
        return;
      }
      setViewportRangeState((prev) => {
        if (prev && prev.start === startKey && prev.end === endKey) {
          return prev;
        }
        return { start: startKey, end: endKey };
      });
    },
    [timelineData],
  );

  const handleStartDoubleClick = useCallback(() => {
    if (!timelineData.length) {
      return;
    }
    applyViewportIndices(0, resolvedEndIndex);
  }, [timelineData.length, resolvedEndIndex, applyViewportIndices]);

  const handleEndDoubleClick = useCallback(() => {
    if (!timelineData.length) {
      return;
    }
    applyViewportIndices(resolvedStartIndex, timelineData.length - 1);
  }, [timelineData.length, resolvedStartIndex, applyViewportIndices]);

  const handleRangeDoubleClick = useCallback(() => {
    if (!timelineData.length) {
      return;
    }
    applyViewportIndices(0, timelineData.length - 1);
  }, [timelineData.length, applyViewportIndices]);

  const isDoubleTap = useCallback((key: "start" | "end" | "range") => {
    const now = Date.now();
    const last = lastTapRef.current[key];
    if (now - last <= DOUBLE_TAP_MS) {
      lastTapRef.current[key] = 0;
      return true;
    }
    lastTapRef.current[key] = now;
    return false;
  }, []);

  const updateViewportFromIndex = useCallback(
    (type: "start" | "end", index: number) => {
      if (!timelineData.length) {
        return;
      }
      const maxIndex = timelineData.length - 1;
      const boundedIndex = Math.max(0, Math.min(index, maxIndex));
      let nextStartIndex = resolvedStartIndex;
      let nextEndIndex = resolvedEndIndex;

      if (type === "start") {
        nextStartIndex = Math.min(boundedIndex, nextEndIndex);
      } else {
        nextEndIndex = Math.max(boundedIndex, nextStartIndex);
      }
      applyViewportIndices(nextStartIndex, nextEndIndex);
    },
    [timelineData, resolvedStartIndex, resolvedEndIndex, applyViewportIndices],
  );

  const handleRangePointerDown = useCallback(
    (type: "start" | "end") =>
      (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!timelineData.length || sliderDisabled) {
          return;
        }
        event.preventDefault();
        rangeDragRef.current = { type, pointerId: event.pointerId, handle: event.currentTarget };
        setIsRangeDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
    [timelineData.length, sliderDisabled],
  );

  const handleRangeBandPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!timelineData.length || sliderDisabled) {
        return;
      }
      event.preventDefault();
      const pointerIndex = pointerPositionToIndex(event.clientX);
      if (pointerIndex === null) {
        return;
      }
      rangeDragRef.current = {
        pointerId: event.pointerId,
        type: "range",
        originIndex: pointerIndex,
        baseStartIndex: resolvedStartIndex,
        baseEndIndex: resolvedEndIndex,
        target: event.currentTarget,
      };
      setIsRangeDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [timelineData.length, sliderDisabled, pointerPositionToIndex, resolvedStartIndex, resolvedEndIndex],
  );

  const handleRangePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = rangeDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      if (drag.type === "range") {
        const index = pointerPositionToIndex(event.clientX);
        if (index === null) {
          return;
        }
        const delta = index - drag.originIndex;
        if (delta === 0) {
          return;
        }
        const total = timelineData.length;
        if (!total) {
          return;
        }
        const maxIndex = total - 1;
        const spanLength = drag.baseEndIndex - drag.baseStartIndex;
        let nextStart = drag.baseStartIndex + delta;
        let nextEnd = drag.baseEndIndex + delta;

        if (nextStart < 0) {
          const shift = -nextStart;
          nextStart += shift;
          nextEnd += shift;
        }
        if (nextEnd > maxIndex) {
          const shift = nextEnd - maxIndex;
          nextStart -= shift;
          nextEnd -= shift;
        }
        nextStart = Math.max(0, Math.min(nextStart, maxIndex - spanLength));
        nextEnd = Math.min(maxIndex, nextStart + spanLength);

        applyViewportIndices(nextStart, nextEnd);
        return;
      }

      const index = pointerPositionToIndex(event.clientX);
      if (index === null) {
        return;
      }
      updateViewportFromIndex(drag.type, index);
    },
    [pointerPositionToIndex, updateViewportFromIndex, timelineData.length, applyViewportIndices],
  );

  const finishRangeDrag = useCallback(
    (pointerId: number, releaseTarget?: HTMLElement | null) => {
      const drag = rangeDragRef.current;
      if (!drag || drag.pointerId !== pointerId) {
        return;
      }
      rangeDragRef.current = null;
      setIsRangeDragging(false);
      const target =
        releaseTarget ??
        (drag.type === "range" ? drag.target : drag.handle);
      if (target) {
        try {
          target.releasePointerCapture(pointerId);
        } catch {
          // ignore release errors
        }
      }
    },
    [setIsRangeDragging],
  );

  const handleRangePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = rangeDragRef.current;
      finishRangeDrag(event.pointerId, event.currentTarget);
      if (!drag || event.pointerType !== "touch") {
        return;
      }
      if (drag.type === "start") {
        if (isDoubleTap("start")) {
          handleStartDoubleClick();
        }
      } else if (drag.type === "end") {
        if (isDoubleTap("end")) {
          handleEndDoubleClick();
        }
      } else if (drag.type === "range") {
        if (isDoubleTap("range")) {
          handleRangeDoubleClick();
        }
      }
    },
    [finishRangeDrag, isDoubleTap, handleStartDoubleClick, handleEndDoubleClick, handleRangeDoubleClick],
  );

  const handleRangePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      finishRangeDrag(event.pointerId, event.currentTarget);
    },
    [finishRangeDrag],
  );

  const handleRangeKeyDown = useCallback(
    (type: "start" | "end") =>
      (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!timelineData.length || sliderDisabled) {
          return;
        }
        const maxIndex = timelineData.length - 1;
        let delta = 0;
        if (event.key === "ArrowLeft") {
          delta = -1;
        } else if (event.key === "ArrowRight") {
          delta = 1;
        }
        if (delta === 0) {
          return;
        }
        event.preventDefault();
        const step = event.shiftKey ? Math.max(1, Math.round(timelineData.length * 0.05)) : 1;
        const baseIndex = type === "start" ? resolvedStartIndex : resolvedEndIndex;
        const nextIndex = Math.max(0, Math.min(maxIndex, baseIndex + delta * step));
        updateViewportFromIndex(type, nextIndex);
      },
    [timelineData.length, sliderDisabled, resolvedStartIndex, resolvedEndIndex, updateViewportFromIndex],
  );

  useEffect(() => {
    if (!isRangeDragging) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const handleWindowPointerUp = (event: PointerEvent) => {
      finishRangeDrag(event.pointerId, null);
    };
    const handleWindowPointerCancel = (event: PointerEvent) => {
      finishRangeDrag(event.pointerId, null);
    };
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);
    return () => {
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
    };
  }, [isRangeDragging, finishRangeDrag]);

  const finalizeDrag = useCallback(
    (range: { anchorKey: string; currentKey: string } | null) => {
      const normalized = normalizeRange(range);
      setDragRange(null);
      if (normalized) {
        setTimelineRange(normalized);
      }
    },
    [normalizeRange, setTimelineRange],
  );

  const cancelDrag = useCallback(() => {
    if (activePointerIdRef.current !== null && svgRef.current) {
      try {
        svgRef.current.releasePointerCapture(activePointerIdRef.current);
      } catch {
        // Swallow release errors (pointer may already be released).
      }
    }
    activePointerIdRef.current = null;
    setDragRange(null);
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!hasChart || !renderData.length) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      const key = resolvePointerKey(event);
      if (!key) {
        return;
      }
      event.preventDefault();
      setTooltip(null);
      activePointerIdRef.current = event.pointerId;
      svgRef.current?.setPointerCapture(event.pointerId);
      setDragRange({ anchorKey: key, currentKey: key });
    },
    [hasChart, renderData, resolvePointerKey],
  );

  const handlePointerMoveDrag = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!dragRange) {
        return;
      }
      const key = resolvePointerKey(event);
      if (!key) {
        return;
      }
      event.preventDefault();
      setDragRange((prev) => (prev ? { anchorKey: prev.anchorKey, currentKey: key } : prev));
    },
    [dragRange, resolvePointerKey],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (activePointerIdRef.current !== null && event.pointerId === activePointerIdRef.current) {
        cancelDrag();
        finalizeDrag(dragRange);
      }
    },
    [dragRange, finalizeDrag, cancelDrag],
  );

  const handlePointerLeave = useCallback(() => {
    if (dragRange) {
      finalizeDrag(dragRange);
      cancelDrag();
    }
  }, [dragRange, finalizeDrag, cancelDrag]);

  const handlePointerCancel = useCallback(() => {
    cancelDrag();
  }, [cancelDrag]);

  const clearSelection = useCallback(() => {
    cancelDrag();
    setTimelineRange(null);
  }, [cancelDrag, setTimelineRange]);

  useEffect(() => {
    return () => {
      cancelDrag();
    };
  }, [cancelDrag]);

  const handlePointerMove = (event: MouseEvent<SVGRectElement>, datum: TimelineDatum) => {
    if (dragRange) {
      return;
    }
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

  const handleTooltipLeave = () => {
    setTooltip(null);
  };

  useEffect(() => {
    if (!timelineRange) {
      return;
    }
    const startExists = indexByKeyAll.has(timelineRange.start);
    const endExists = indexByKeyAll.has(timelineRange.end);
    if (!startExists || !endExists) {
      setTimelineRange(null);
    }
  }, [timelineRange, indexByKeyAll, setTimelineRange]);

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
  } else if (!hasTimeline) {
    body = (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        No tweet history is available yet.
      </div>
    );
  } else {
    body = (
      <div
        ref={containerRef}
        className="relative w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-4 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 sm:px-4 sm:py-8"
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="Monthly tweet volume bar chart"
          width={chartWidth}
          height={chartHeight}
          className="block touch-none select-none"
          ref={svgRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMoveDrag}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerCancel}
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
            {renderData.map((datum) => {
              const x = xScale(datum.key);
              if (typeof x !== "number") {
                return null;
              }
              const y = yScale(datum.count);
              const height = baseline - y;
              const fullWidth = xScale.bandwidth();
              const clampedWidth = Math.max(2, Math.min(fullWidth, MAX_BAR_WIDTH));
              const offsetX = x + (fullWidth - clampedWidth) / 2;
              const isActive = selectionKeys.has(datum.key);
              const className = [
                "transition-colors",
                isActive
                  ? "fill-blue-500/70 hover:fill-blue-500 dark:fill-blue-300/60 dark:hover:fill-blue-300"
                  : selectionActive
                  ? "fill-zinc-900/30 hover:fill-zinc-900/50 dark:fill-zinc-100/20 dark:hover:fill-zinc-100/40"
                  : "fill-zinc-900/80 hover:fill-zinc-900 dark:fill-zinc-100/60 dark:hover:fill-zinc-100",
              ].join(" ");

              return (
                <rect
                  key={datum.key}
                  x={offsetX}
                  y={y}
                  width={clampedWidth}
                  height={height < 0 ? 0 : height}
                  className={className}
                  onMouseEnter={(event) => handlePointerMove(event, datum)}
                  onMouseMove={(event) => handlePointerMove(event, datum)}
                  onMouseLeave={handleTooltipLeave}
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
        {renderData.length > 0 ? (
          <div className="mt-4" style={{ width: chartWidth }}>
            <div className="relative h-10">
              <div
                ref={rangeTrackRef}
                className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700"
                style={{ left: sliderLeft, width: sliderWidth }}
              />
              <div
                className="absolute top-1/2 z-0 -translate-y-1/2 cursor-grab rounded-lg border border-zinc-300/70 bg-zinc-200/60 transition-colors active:cursor-grabbing dark:border-zinc-600/70 dark:bg-zinc-700/50"
                style={{
                  left: highlightLeft,
                  width: highlightWidth,
                  height: 20,
                  pointerEvents: sliderDisabled ? "none" : "auto",
                  touchAction: "none",
                }}
                onPointerDown={handleRangeBandPointerDown}
                onPointerMove={handleRangePointerMove}
                onPointerUp={handleRangePointerUp}
                onPointerCancel={handleRangePointerCancel}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  handleRangeDoubleClick();
                }}
              />
              <button
                type="button"
                className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-400 bg-white shadow-sm cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-500 dark:bg-zinc-800 dark:focus-visible:outline-zinc-400 h-2.5 w-2.5"
                style={{ left: startHandleLeft, touchAction: "none" }}
                onPointerDown={handleRangePointerDown("start")}
                onPointerMove={handleRangePointerMove}
                onPointerUp={handleRangePointerUp}
                onPointerCancel={handleRangePointerCancel}
                onKeyDown={handleRangeKeyDown("start")}
                aria-label="Adjust displayed range start"
                disabled={sliderDisabled}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  handleStartDoubleClick();
                }}
              />
              <button
                type="button"
                className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-400 bg-white shadow-sm cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-500 dark:bg-zinc-800 dark:focus-visible:outline-zinc-400 h-2.5 w-2.5"
                style={{ left: endHandleLeft, touchAction: "none" }}
                onPointerDown={handleRangePointerDown("end")}
                onPointerMove={handleRangePointerMove}
                onPointerUp={handleRangePointerUp}
                onPointerCancel={handleRangePointerCancel}
                onKeyDown={handleRangeKeyDown("end")}
                aria-label="Adjust displayed range end"
                disabled={sliderDisabled}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  handleEndDoubleClick();
                }}
              />
            </div>
            <div
              className="mt-4 flex justify-between text-[0.7rem] uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              style={{ paddingLeft: sliderLeft, paddingRight: CHART_MARGIN.right }}
            >
              <span>{viewportLabelStart ?? "—"}</span>
              <span>{viewportLabelEnd ?? "—"}</span>
            </div>
          </div>
        ) : null}
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
        {selectionActive && selectionLabel ? (
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
            <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold dark:bg-blue-500/10">
              {selectionLabel}
            </span>
            <button
              type="button"
              className="pointer-events-auto rounded-full border border-blue-200 px-3 py-1 font-medium text-blue-600 transition hover:border-blue-300 hover:text-blue-500 dark:border-blue-400/50 dark:text-blue-200 dark:hover:border-blue-300"
              onClick={clearSelection}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg bg-white p-4 sm:p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div>
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
          Tweets over time
        </h2>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
        <span role="img" aria-hidden="true" className="mr-2">
          📈
        </span>
        Drag horizontally on the graph to filter threads in the next section.
      </div>
      {body}
    </section>
  );
};
