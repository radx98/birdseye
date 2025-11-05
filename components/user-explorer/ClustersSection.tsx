"use client";

import { useUserExplorer } from "./context";
import { formatDate, formatHandle, formatNumber } from "./formatters";

const stripMarkdownLinks = (value?: string | null) =>
  value ? value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") : value ?? "";

const normalizeHandle = (value?: string | null) =>
  value ? value.replace(/^@/, "").trim().toLowerCase() : "";

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

  const hasClusterResults = Boolean(clustersData && clustersData.clusters.length > 0);

  if (!summary && !clustersLoading) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6 rounded-lg bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            Loading clusters…
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
              <div className="overflow-hidden" style={{ height: "75vh" }}>
                <div className="h-full overflow-auto">
                  <table className="min-w-full border-collapse text-sm text-zinc-700 dark:text-zinc-200">
                    <thead className="sticky top-0 z-10 bg-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/80 dark:text-zinc-300">
                      <tr>
                        <th className="px-4 py-3 text-left">Name</th>
                        <th className="px-4 py-3 text-right">Number of Tweets</th>
                        <th className="px-4 py-3 text-right">Median Likes</th>
                        <th className="px-4 py-3 text-right">Total Likes</th>
                        <th className="px-4 py-3 text-right">Median Date</th>
                        <th className="px-4 py-3 text-right">Tweets per Month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClusters.map((cluster) => {
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
                            <td className="px-4 py-3 text-right">{cluster.tweetsPerMonthLabel || "placeholder"}</td>
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
