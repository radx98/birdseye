"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { ClusterSparkline } from "./ClusterSparkline";
import { useUserExplorer } from "./context";
import { formatDate, formatHandle, formatNumber } from "./formatters";
import type { ClusterInfo } from "@/types/cluster";

const stripMarkdownLinks = (value?: string | null) =>
  value ? value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") : value ?? "";

const normalizeHandle = (value?: string | null) =>
  value ? value.replace(/^@/, "").trim().toLowerCase() : "";

type SortDirection = "asc" | "desc";
type ClusterSortKey = "name" | "tweetsCount" | "medianLikes" | "totalLikes" | "medianDate" | "tweetsPerMonth";

const getDefaultDirection = (key: ClusterSortKey): SortDirection => (key === "name" ? "asc" : "desc");

const resolveTweetsPerMonthTotal = (cluster: ClusterInfo) => {
  if (!cluster || !Array.isArray(cluster.tweetsPerMonth)) {
    return 0;
  }
  let total = 0;
  for (const entry of cluster.tweetsPerMonth) {
    if (!entry) {
      continue;
    }
    const count = Number(entry.count);
    if (Number.isFinite(count)) {
      total += count;
    }
  }
  return total;
};

type SortState = {
  key: ClusterSortKey;
  direction: SortDirection;
};

const EMOJI_RANGES: Array<[number, number]> = [
  [0x1f300, 0x1f5ff],
  [0x1f600, 0x1f64f],
  [0x1f680, 0x1f6ff],
  [0x1f700, 0x1f77f],
  [0x1f780, 0x1f7ff],
  [0x1f800, 0x1f8ff],
  [0x1f900, 0x1f9ff],
  [0x1fa00, 0x1fa6f],
  [0x1fa70, 0x1faff],
  [0x2600, 0x26ff],
  [0x2700, 0x27bf],
];

const isEmojiCodePoint = (point: number) => {
  for (const [start, end] of EMOJI_RANGES) {
    if (point >= start && point <= end) {
      return true;
    }
  }
  return false;
};

const stripLeadingEmoji = (value: string) => {
  if (!value) {
    return "";
  }
  const trimmed = value.trimStart();
  if (!trimmed) {
    return "";
  }

  const firstCodePoint = trimmed.codePointAt(0);
  if (firstCodePoint === undefined) {
    return trimmed;
  }

  if (!isEmojiCodePoint(firstCodePoint)) {
    return trimmed;
  }

  const firstCharLength = firstCodePoint > 0xffff ? 2 : 1;
  let remainder = trimmed.slice(firstCharLength);

  if (remainder.startsWith("\uFE0F")) {
    remainder = remainder.slice(1);
  }

  const withoutLeadingSpace = remainder.replace(/^\s+/, "");
  const normalized = withoutLeadingSpace.length ? withoutLeadingSpace : remainder.trimStart();
  return normalized.length ? normalized : trimmed;
};

export const ClustersSection = () => {
  const {
    summary,
    clustersError,
    clustersData,
    clustersLoading,
    hideLowQuality,
    toggleHideLowQuality,
    filteredClusters,
    selectedCluster,
    setSelectedClusterId,
    hasAvailableClusters,
  } = useUserExplorer();

  const [sortState, setSortState] = useState<SortState>({ key: "medianDate", direction: "desc" });

  const sortedClusters = useMemo(() => {
    if (!filteredClusters.length) {
      return [];
    }

    const totalsCache = new Map<string, number>();
    const getTotal = (cluster: ClusterInfo) => {
      if (totalsCache.has(cluster.id)) {
        return totalsCache.get(cluster.id)!;
      }
      const total = resolveTweetsPerMonthTotal(cluster);
      totalsCache.set(cluster.id, total);
      return total;
    };

    const next = [...filteredClusters];
    const { key, direction } = sortState;

    next.sort((a, b) => {
      switch (key) {
        case "name": {
          const rawA = a.name || a.id || "";
          const rawB = b.name || b.id || "";
          const labelA = stripLeadingEmoji(rawA).toLowerCase();
          const labelB = stripLeadingEmoji(rawB).toLowerCase();
          if (labelA !== labelB) {
            return direction === "asc" ? labelA.localeCompare(labelB) : labelB.localeCompare(labelA);
          }
          break;
        }
        case "tweetsCount": {
          const valueA = a.tweetsCount ?? 0;
          const valueB = b.tweetsCount ?? 0;
          if (valueA !== valueB) {
            return direction === "asc" ? valueA - valueB : valueB - valueA;
          }
          break;
        }
        case "medianLikes": {
          const valueA = a.medianLikes ?? 0;
          const valueB = b.medianLikes ?? 0;
          if (valueA !== valueB) {
            return direction === "asc" ? valueA - valueB : valueB - valueA;
          }
          break;
        }
        case "totalLikes": {
          const valueA = a.totalLikes ?? 0;
          const valueB = b.totalLikes ?? 0;
          if (valueA !== valueB) {
            return direction === "asc" ? valueA - valueB : valueB - valueA;
          }
          break;
        }
        case "medianDate": {
          const timeA = a.medianDate ? Date.parse(a.medianDate) : Number.NaN;
          const timeB = b.medianDate ? Date.parse(b.medianDate) : Number.NaN;
          const hasA = Number.isFinite(timeA);
          const hasB = Number.isFinite(timeB);
          if (hasA && hasB) {
            if (timeA !== timeB) {
              return direction === "asc" ? timeA - timeB : timeB - timeA;
            }
          } else if (hasA !== hasB) {
            return hasA ? -1 : 1;
          }
          break;
        }
        case "tweetsPerMonth": {
          const totalA = getTotal(a);
          const totalB = getTotal(b);
          if (totalA !== totalB) {
            return direction === "asc" ? totalA - totalB : totalB - totalA;
          }
          break;
        }
        default:
          break;
      }

      const fallbackA = a.medianDate ? Date.parse(a.medianDate) : Number.NEGATIVE_INFINITY;
      const fallbackB = b.medianDate ? Date.parse(b.medianDate) : Number.NEGATIVE_INFINITY;

      if (Number.isFinite(fallbackA) && Number.isFinite(fallbackB) && fallbackA !== fallbackB) {
        return fallbackB - fallbackA;
      }

      return (b.tweetsCount ?? 0) - (a.tweetsCount ?? 0);
    });

    return next;
  }, [filteredClusters, sortState]);

  const handleSort = (key: ClusterSortKey) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        key,
        direction: getDefaultDirection(key),
      };
    });
  };

  const hasClusterResults = Boolean(clustersData && clustersData.clusters.length > 0);
const renderSortIcon = (key: ClusterSortKey) => {
  const isActive = sortState.key === key;
  return (
    <Image
      src="/dropdown.png"
      alt=""
      width={12}
      height={12}
      aria-hidden="true"
      className={`ml-auto h-2 w-2 transition-transform ${isActive ? "opacity-70" : "invisible"} ${
        isActive && sortState.direction === "asc" ? "rotate-180" : ""
      } dark:invert`}
    />
  );
};

  if (!summary && !clustersLoading) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6 rounded-lg bg-white p-4 sm:p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">Clusters</h2>
        {clustersData && (
          <div className="flex items-center">
            <span className="text-xs font-medium mr-2 text-zinc-500 dark:text-zinc-400">
              Hide low quality clusters
            </span>
            <div className="relative mr-3 group">
              <button
                type="button"
                aria-describedby="low-quality-tooltip"
                className="flex h-3 w-3 items-center justify-center rounded-full border border-zinc-400 text-[0.55rem] font-semibold text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-500 dark:border-zinc-600 dark:text-zinc-500 dark:hover:border-zinc-500 dark:hover:text-zinc-400"
                aria-label="Filter help"
              >
                i
              </button>
              <div
                id="low-quality-tooltip"
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-4 hidden w-48 -translate-x-1/2 rounded-md bg-black px-3 py-2 text-xs leading-snug text-white shadow-md group-hover:flex group-focus-within:flex dark:bg-white dark:text-zinc-900"
              >
                Filter out clusters marked as low quality by the AI.
              </div>
            </div>
            <button
              type="button"
              onClick={toggleHideLowQuality}
              aria-pressed={hideLowQuality}
              disabled={!hasClusterResults}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                hideLowQuality ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <span className="sr-only">Toggle hide low quality clusters</span>
              <span
                className={`absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 transform rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${
                  hideLowQuality ? "translate-x-[16px]" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {clustersError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
          {clustersError}
        </p>
      )}

      {clustersLoading && !clustersData && (
        <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
            Loading...
          </span>
        </div>
      )}

      {clustersData && !clustersLoading && (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            <span role="img" aria-hidden="true" className="mr-2">
              ⚡
            </span>
            Clusters are automatically sorted by recency. Some (especially the largest ones) may be too broad or noisy.
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition-colors dark:border-zinc-700 dark:bg-zinc-900/50">
            {hasAvailableClusters ? (
              <div className="relative" style={{ height: "80vh" }}>
                <div className="h-full overflow-y-auto overflow-x-auto lg:overflow-x-hidden">
                  <table className="w-full min-w-[64rem] border-collapse text-sm text-zinc-700 dark:text-zinc-200 lg:min-w-full">
                    <thead className="sticky top-0 z-10 bg-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-300">
                      <tr>
                        <th
                          className="px-0 py-0 text-left"
                          scope="col"
                          aria-sort={sortState.key === "name" ? (sortState.direction === "asc" ? "ascending" : "descending") : undefined}
                        >
                          <button
                            type="button"
                            onClick={() => handleSort("name")}
                            className="flex h-14 w-full items-center justify-between gap-2 px-4 text-left transition-colors hover:bg-zinc-200/60 focus-visible:bg-zinc-200/80 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/70"
                          >
                            <span>Name</span>
                            {renderSortIcon("name")}
                          </button>
                        </th>
                        <th
                          className="px-0 py-0 text-left"
                          scope="col"
                          aria-sort={
                            sortState.key === "tweetsCount" ? (sortState.direction === "asc" ? "ascending" : "descending") : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleSort("tweetsCount")}
                            className="flex h-14 w-full items-center justify-between gap-2 px-4 text-left transition-colors hover:bg-zinc-200/60 focus-visible:bg-zinc-200/80 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/70"
                          >
                            <span>Tweets</span>
                            {renderSortIcon("tweetsCount")}
                          </button>
                        </th>
                        <th
                          className="px-0 py-0 text-left"
                          scope="col"
                          aria-sort={
                            sortState.key === "medianLikes" ? (sortState.direction === "asc" ? "ascending" : "descending") : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleSort("medianLikes")}
                            className="flex h-14 w-full items-center justify-between gap-2 px-4 text-left transition-colors hover:bg-zinc-200/60 focus-visible:bg-zinc-200/80 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/70"
                          >
                            <span>Median Likes</span>
                            {renderSortIcon("medianLikes")}
                          </button>
                        </th>
                        <th
                          className="px-0 py-0 text-left"
                          scope="col"
                          aria-sort={
                            sortState.key === "totalLikes" ? (sortState.direction === "asc" ? "ascending" : "descending") : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleSort("totalLikes")}
                            className="flex h-14 w-full items-center justify-between gap-2 px-4 text-left transition-colors hover:bg-zinc-200/60 focus-visible:bg-zinc-200/80 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/70"
                          >
                            <span>Total Likes</span>
                            {renderSortIcon("totalLikes")}
                          </button>
                        </th>
                        <th
                          className="px-0 py-0 text-left"
                          scope="col"
                          aria-sort={
                            sortState.key === "medianDate" ? (sortState.direction === "asc" ? "ascending" : "descending") : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleSort("medianDate")}
                            className="flex h-14 w-full items-center justify-between gap-2 px-4 text-left transition-colors hover:bg-zinc-200/60 focus-visible:bg-zinc-200/80 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/70"
                          >
                            <span>Median Date</span>
                            {renderSortIcon("medianDate")}
                          </button>
                        </th>
                        <th
                          className="px-0 py-0 text-left"
                          scope="col"
                          aria-sort={
                            sortState.key === "tweetsPerMonth" ? (sortState.direction === "asc" ? "ascending" : "descending") : undefined
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleSort("tweetsPerMonth")}
                            className="flex h-14 w-full items-center justify-between gap-2 px-4 text-left transition-colors hover:bg-zinc-200/60 focus-visible:bg-zinc-200/80 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/70"
                          >
                            <span>Tweets per Month</span>
                            {renderSortIcon("tweetsPerMonth")}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedClusters.map((cluster) => {
                        const isSelected = selectedCluster?.id === cluster.id;
                        return (
                          <tr
                            key={cluster.id}
                            onClick={() => setSelectedClusterId(cluster.id)}
                            aria-selected={isSelected}
                            className={`cursor-pointer border-b border-zinc-200 transition-colors last:border-none dark:border-zinc-800 ${
                              isSelected
                                ? "bg-zinc-100/80 dark:bg-zinc-800/70"
                                : "hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                            }`}
                          >
                            <td className="px-4 py-3 text-left font-medium text-zinc-900 dark:text-zinc-100">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{cluster.name || cluster.id}</span>
                                {cluster.lowQuality && (
                                  <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium lowercase text-rose-600 dark:bg-rose-500/20 dark:text-rose-200 whitespace-nowrap">
                                    low quality
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">{formatNumber(cluster.tweetsCount)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(cluster.medianLikes)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(cluster.totalLikes)}</td>
                            <td className="px-4 py-3 text-right">{formatDate(cluster.medianDate)}</td>
                            <td className="relative px-4 py-3 align-middle min-w-[12rem]">
                              <div className="absolute inset-x-0 inset-y-1">
                                <ClusterSparkline data={cluster.tweetsPerMonth} />
                              </div>
                              <span className="sr-only">Tweets per month sparkline</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[12rem] items-center justify-center text-sm text-zinc-600 dark:text-zinc-300">
                {hideLowQuality ? "No high-quality clusters available." : "No clusters available."}
              </div>
            )}
          </div>

          {selectedCluster && hasAvailableClusters && (
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 lg:col-span-2">
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  Selected Cluster
                </h3>
                {selectedCluster.name || selectedCluster.id}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tweets</span>
                    <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                      {formatNumber(selectedCluster.tweetsCount)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Likes</span>
                    <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                      {formatNumber(selectedCluster.totalLikes)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Median Date</span>
                    <span className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                      {formatDate(selectedCluster.medianDate)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 text-sm text-zinc-600 transition-colors dark:text-zinc-300">
                  {stripMarkdownLinks(selectedCluster.summary) || "No summary available for this cluster."}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  Most replied to
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {(() => {
                    const currentHandle = normalizeHandle(summary?.handle);
                    const filtered = selectedCluster.mostRepliedTo.filter(
                      (entry) => normalizeHandle(entry.username) !== currentHandle,
                    );
                    const topFive = filtered
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 5);
                    return topFive.length > 0 ? (
                      topFive.map((entry) => (
                        <li key={entry.username}>
                          {formatHandle(entry.username)} ({formatNumber(entry.count)})
                        </li>
                      ))
                    ) : (
                      <li>No reply data available.</li>
                    );
                  })()}
                </ul>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  Related Clusters
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {selectedCluster.relatedClusters.length > 0 ? (
                    selectedCluster.relatedClusters.map((related) => (
                      <li key={related.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedClusterId(related.id)}
                          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800/80"
                        >
                          <span>{related.name || related.id}</span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li>No related clusters available.</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
