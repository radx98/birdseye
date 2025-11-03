"use client";

import { useUserExplorer } from "./context";
import { formatDate, formatHandle, formatNumber } from "./formatters";

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
    <section className="flex flex-col gap-6 rounded-4xl bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">Clusters</h2>
        {clustersData && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleHideLowQuality}
              aria-pressed={hideLowQuality}
              disabled={!hasClusterResults}
              className="inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:border-zinc-600"
            >
              <span
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  hideLowQuality ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    hideLowQuality ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </span>
              Hide low quality clusters
            </button>
            <button
              type="button"
              title="Filter out clusters marked as low quality by the AI"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
              aria-label="Filter help"
            >
              i
            </button>
          </div>
        )}
      </div>

      {clustersError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
          {clustersError}
        </p>
      )}

      {clustersLoading && !clustersData && (
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
            Loading clusters…
          </span>
        </div>
      )}

      {clustersData && !clustersLoading && (
        <>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            <span role="img" aria-hidden="true" className="mr-2">
              ⚡
            </span>
            Clusters are automatically sorted by recency. Some (especially the largest ones) may be too broad or noisy.
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 transition-colors dark:border-zinc-700 dark:bg-zinc-900/50">
            {hasAvailableClusters ? (
              <div className="overflow-hidden">
                <div className="relative" style={{ aspectRatio: "4 / 3" }}>
                  <div className="absolute inset-0 overflow-auto">
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
                                <div className="flex items-center gap-2">
                                  <span>{cluster.name || cluster.id}</span>
                                  {cluster.lowQuality && (
                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-200">
                                      Low quality
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
              </div>
            ) : (
              <div className="flex min-h-[12rem] items-center justify-center text-sm text-zinc-600 dark:text-zinc-300">
                {hideLowQuality ? "No high-quality clusters available." : "No clusters available."}
              </div>
            )}
          </div>

          {selectedCluster && hasAvailableClusters && (
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 lg:col-span-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  Selected Cluster
                </h3>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedCluster.name || selectedCluster.id}
                </p>
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
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {selectedCluster.summary || "No summary available for this cluster."}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  Most replied to
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {selectedCluster.mostRepliedTo.length > 0 ? (
                    selectedCluster.mostRepliedTo.map((entry) => (
                      <li key={entry.username}>
                        {formatHandle(entry.username)} ({formatNumber(entry.count)})
                      </li>
                    ))
                  ) : (
                    <li>No reply data available.</li>
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  Related Clusters
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {selectedCluster.relatedClusters.length > 0 ? (
                    selectedCluster.relatedClusters.map((related) => (
                      <li key={related.id}>{related.name || related.id}</li>
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
