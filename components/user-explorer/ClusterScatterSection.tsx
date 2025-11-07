"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { ClusterEmbeddingPoint } from "@/types/embedding";
import { useUserExplorer } from "./context";

type ChartEmbeddingPoint = ClusterEmbeddingPoint & {
  clusterName: string;
};

const MARGIN = { top: 20, right: 20, bottom: 40, left: 50 };

export const ClusterScatterSection = () => {
  const {
    summary,
    clustersLoading,
    clustersData,
    embeddingsData,
    embeddingsLoading,
    embeddingsError,
    hasAvailableClusters,
    selectedCluster,
    setSelectedClusterId,
  } = useUserExplorer();

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizeTrigger, setResizeTrigger] = useState(0);

  const clusterNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const clusters = clustersData?.clusters ?? [];
    for (const cluster of clusters) {
      if (!cluster) {
        continue;
      }
      const id = cluster.id?.trim();
      if (!id) {
        continue;
      }
      const label = cluster.name?.trim() || id;
      map.set(id, label);
    }
    return map;
  }, [clustersData]);

  const embeddings = useMemo<ChartEmbeddingPoint[]>(() => {
    const base = embeddingsData?.embeddings ?? [];
    if (!base.length) {
      return [];
    }
    return base.map((entry) => {
      const clusterId = entry.clusterId?.trim() || "unassigned";
      const clusterName = clusterNameMap.get(clusterId) ?? clusterId;
      return {
        ...entry,
        clusterId,
        clusterName,
      };
    });
  }, [embeddingsData, clusterNameMap]);

  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const lastContextClusterIdRef = useRef<string | null>(null);
  const selectedClusterId = selectedCluster?.id ?? null;

  useEffect(() => {
    if (selectedClusterId !== lastContextClusterIdRef.current) {
      lastContextClusterIdRef.current = selectedClusterId;
      setActiveClusterId(selectedClusterId);
    }
  }, [selectedClusterId]);

  const clearClusterSelection = useCallback(() => {
    setActiveClusterId((current) => (current !== null ? null : current));
  }, []);

  const handleClusterActivate = useCallback(
    (clusterId: string) => {
      setActiveClusterId((current) => {
        if (current === clusterId) {
          return null;
        }
        return clusterId;
      });
      setSelectedClusterId(clusterId);
    },
    [setSelectedClusterId],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      setResizeTrigger((prev) => prev + 1);
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [embeddings.length]);

  const colorScale = useMemo(() => {
    const palette = [...d3.schemeTableau10, ...d3.schemePaired, ...d3.schemeSet3];
    const scale = d3.scaleOrdinal<string, string>(palette);
    if (embeddings.length) {
      const clusterIds = Array.from(
        new Set(embeddings.map((embedding) => embedding.clusterId || "unassigned")),
      );
      scale.domain(clusterIds);
    }
    return scale;
  }, [embeddings]);

  const clusterSummaries = useMemo(() => {
    if (!embeddings.length) {
      return [];
    }
    const counts = new Map<string, { id: string; name: string; count: number }>();
    for (const embedding of embeddings) {
      const id = embedding.clusterId || "unassigned";
      const current = counts.get(id);
      if (current) {
        current.count += 1;
      } else {
        counts.set(id, {
          id,
          name: embedding.clusterName || id,
          count: 1,
        });
      }
    }
    return Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [embeddings]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !embeddings.length) {
      return;
    }

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);

    svg.selectAll("*").remove();

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const width = containerWidth - MARGIN.left - MARGIN.right;
    const height = containerHeight - MARGIN.top - MARGIN.bottom;

    if (width <= 0 || height <= 0) {
      return;
    }

    const sortedX = embeddings.map((entry) => entry.x).sort((a, b) => a - b);
    const sortedY = embeddings.map((entry) => entry.y).sort((a, b) => a - b);
    const percentileValue = (values: number[], percentile: number) => {
      if (!values.length) {
        return 0;
      }
      const clamped = Math.max(0, Math.min(0.999, percentile));
      const index = Math.min(values.length - 1, Math.floor(values.length * clamped));
      return values[index] ?? values[values.length - 1] ?? 0;
    };

    const xMin = percentileValue(sortedX, 0.02);
    const xMax = percentileValue(sortedX, 0.98);
    const yMin = percentileValue(sortedY, 0.02);
    const yMax = percentileValue(sortedY, 0.98);

    const xPadding = (xMax - xMin || 1) * 0.1;
    const yPadding = (yMax - yMin || 1) * 0.1;

    const xScale = d3.scaleLinear().domain([xMin - xPadding, xMax + xPadding]).range([0, width]);
    const yScale = d3.scaleLinear().domain([yMin - yPadding, yMax + yPadding]).range([height, 0]);

    const clipId = `clip-${Math.random().toString(36).slice(2, 11)}`;

    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", width)
      .attr("height", height);

    const group = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    group
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(8))
      .attr("class", "text-zinc-500 dark:text-zinc-400")
      .selectAll("line, path")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 1);

    group
      .append("g")
      .call(d3.axisLeft(yScale).ticks(8))
      .attr("class", "text-zinc-500 dark:text-zinc-400")
      .selectAll("line, path")
      .attr("stroke", "currentColor")
      .attr("stroke-width", 1);

    const tooltip = d3
      .select("body")
      .append("div")
      .attr(
        "class",
        "fixed pointer-events-none opacity-0 transition-opacity duration-200 bg-black text-white dark:bg-white dark:text-zinc-900 text-xs rounded px-3 py-2 shadow-lg z-50",
      )
      .style("left", "0px")
      .style("top", "0px");

    group
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("click", () => {
        clearClusterSelection();
      });

    const pointsGroup = group.append("g").attr("clip-path", `url(#${clipId})`);

    pointsGroup
      .selectAll<SVGCircleElement, ChartEmbeddingPoint>("circle")
      .data(embeddings)
      .enter()
      .append("circle")
      .attr("cx", (datum) => xScale(datum.x))
      .attr("cy", (datum) => yScale(datum.y))
      .attr("r", 3)
      .attr("fill", (datum) => colorScale(datum.clusterId) ?? "#7c3aed")
      .attr("opacity", (datum) => {
        if (activeClusterId && datum.clusterId !== activeClusterId) {
          return 0.15;
        }
        return 0.7;
      })
      .attr("class", "transition-opacity hover:opacity-100 cursor-pointer")
      .on("mouseover", function (event, datum) {
        event.stopPropagation();
        d3.select(this).attr("opacity", 1).attr("r", 5);
        tooltip
          .style("opacity", 1)
          .html(`<strong>${datum.clusterName}</strong>`);
      })
      .on("mousemove", function (event) {
        const pointerEvent = event as PointerEvent;
        tooltip
          .style("left", `${pointerEvent.clientX + 10}px`)
          .style("top", `${pointerEvent.clientY - 10}px`);
      })
      .on("mouseout", function (event, datum) {
        if (activeClusterId && datum.clusterId !== activeClusterId) {
          d3.select(this).attr("opacity", 0.15).attr("r", 3);
        } else {
          d3.select(this).attr("opacity", 0.7).attr("r", 3);
        }
        tooltip.style("opacity", 0);
      })
      .on("click", function (event, datum) {
        event.stopPropagation();
        handleClusterActivate(datum.clusterId);
      });

    return () => {
      tooltip.remove();
    };
  }, [embeddings, colorScale, resizeTrigger, activeClusterId, handleClusterActivate, clearClusterSelection]);

  if (!summary && !clustersLoading && !embeddingsLoading) {
    return null;
  }

  const showLoading = embeddingsLoading || (clustersLoading && !hasAvailableClusters);
  const hasData = embeddings.length > 0 && hasAvailableClusters;
  const projectionSource =
    embeddingsData && embeddingsData.originalDimensions > 1
      ? `${embeddingsData.originalDimensions}-dimensional embedding`
      : "high-dimensional embedding";

  let body;

  if (showLoading) {
    body = (
      <div
        className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
        style={{ height: "60vh" }}
      >
        <span className="inline-flex items-center gap-2">
          <span
            className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500"
            aria-hidden="true"
          />
          Loading embeddings...
        </span>
      </div>
    );
  } else if (embeddingsError) {
    body = (
      <div
        className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 transition-colors dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200"
        style={{ height: "60vh" }}
      >
        <div className="flex h-full items-center justify-center text-center">
          Unable to load embeddings for this user. {embeddingsError}
        </div>
      </div>
    );
  } else if (!hasAvailableClusters) {
    body = (
      <div
        className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
        style={{ height: "60vh" }}
      >
        No clusters are available with the current filters.
      </div>
    );
  } else if (!hasData) {
    body = (
      <div
        className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
        style={{ height: "60vh" }}
      >
        Embedding data is not available for visualization.
      </div>
    );
  } else {
    body = (
      <>
        <div
          ref={containerRef}
          className="relative rounded-lg border border-zinc-200 bg-zinc-50 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60"
          style={{ height: "60vh", width: "100%" }}
        >
          <svg ref={svgRef} width="100%" height="100%" className="overflow-hidden" />
        </div>
        {clusterSummaries.length > 0 && (
          <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {clusterSummaries.map((cluster) => {
              const color = colorScale(cluster.id) ?? "#7c3aed";
              const isActive = activeClusterId === cluster.id;
              const isDimmed = Boolean(activeClusterId && cluster.id !== activeClusterId);
              return (
                <button
                  type="button"
                  key={cluster.id}
                  onClick={() => handleClusterActivate(cluster.id)}
                  className={`relative flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:focus-visible:ring-zinc-300 ${isDimmed ? "opacity-50" : ""}`}
                  aria-pressed={isActive}
                  style={
                    isActive
                      ? {
                          borderColor: color,
                          boxShadow: `0 0 0 1px ${color}`,
                        }
                      : undefined
                  }
                >
                  <span
                    className="absolute left-1 top-1 bottom-1 w-[6px] rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <div className="ml-3 flex flex-col">
                    <span className="text-xs font-medium text-zinc-700 transition-colors dark:text-zinc-200">
                      {cluster.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  }

  return (
    <section className="flex flex-col gap-6 rounded-lg bg-white p-4 sm:p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div>
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
          Cluster Distribution
        </h2>
      </div>
      {body}
    </section>
  );
};
