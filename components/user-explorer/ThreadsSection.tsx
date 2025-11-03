"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useUserExplorer, type ThreadSortKey } from "./context";
import { formatDate, formatHandle, formatNumber } from "./formatters";

const SORT_OPTIONS: Array<{ value: ThreadSortKey; label: string }> = [
  { value: "favorite-count", label: "Favorite Count" },
  { value: "date", label: "Date" },
  { value: "cluster-probability", label: "Cluster Probability" },
];

const formatProbability = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  if (value >= 0.995) {
    return "100%";
  }
  return `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
};

export const ThreadsSection = () => {
  const {
    summary,
    clustersData,
    threadsLoading,
    threadsError,
    hideReplies,
    toggleHideReplies,
    hideRetweets,
    toggleHideRetweets,
    hideIncompleteThreads,
    toggleHideIncompleteThreads,
    threadSortKey,
    setThreadSortKey,
    threadSortAscending,
    setThreadSortAscending,
    visibleThreads,
    hasThreadData,
    hasVisibleThreads,
    selectedCluster,
  } = useUserExplorer();

  const sortLabelId = "threads-sort";

  const clusterNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (clustersData?.clusters) {
      for (const cluster of clustersData.clusters) {
        const name = cluster.name || cluster.id;
        if (cluster.id) {
          map.set(cluster.id, name);
        }
      }
    }
    return map;
  }, [clustersData]);

  const body = useMemo(() => {
    if (threadsLoading && !hasThreadData) {
      return (
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
            Loading threads…
          </span>
        </div>
      );
    }

    if (threadsError && !hasThreadData) {
      return (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
          {threadsError}
        </div>
      );
    }

    if (!hasThreadData) {
      return (
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          Threads are not available for this user yet.
        </div>
      );
    }

    if (!hasVisibleThreads) {
      const clusterName = selectedCluster?.name || selectedCluster?.id;
      return (
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          {clusterName
            ? `No threads match the current filters for ${clusterName}. Try adjusting the toggles above.`
            : "No threads match the current filters. Try adjusting the toggles above."}
        </div>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleThreads.map((thread) => {
          const threadClusterLabel =
            thread.clusterId && clusterNameMap.has(thread.clusterId)
              ? clusterNameMap.get(thread.clusterId)!
              : thread.clusterId || "Unassigned";

          return (
            <article
              key={thread.id}
              className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60"
            >
              <div className="flex flex-col gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center justify-between gap-2 text-[0.7rem] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <span>{threadClusterLabel ? `Cluster: ${threadClusterLabel}` : "Cluster view"}</span>
                  <span>{`Max prob: ${formatProbability(thread.maxClusterProb)}`}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-200">
                    <span aria-hidden="true">❤️</span>
                    <span>{formatNumber(thread.totalFavorites)}</span>
                  </span>
                  <span className="text-xs">{formatDate(thread.rootCreatedAt)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {thread.isIncomplete && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[0.7rem] font-medium text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
                      Incomplete
                    </span>
                  )}
                  {thread.rootIsReply && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[0.7rem] font-medium text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
                      Starts as reply
                    </span>
                  )}
                  {thread.containsRetweet && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[0.7rem] font-medium text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
                      Includes retweet
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {thread.tweets.map((tweet, index) => (
                  <div key={tweet.id || `${thread.id}-${index}`} className="flex flex-col gap-3">
                    {index > 0 && (
                      <div className="border-t border-dashed border-zinc-200 dark:border-zinc-700" aria-hidden="true" />
                    )}
                    <div className="flex gap-3">
                      {tweet.username ? (
                        <Image
                          src={`https://unavatar.io/twitter/${encodeURIComponent(tweet.username)}`}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-zinc-300 text-xs font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">
                          ?
                        </div>
                      )}
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                              {formatHandle(tweet.username) || "Unknown"}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {formatDate(tweet.createdAt)}
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                            <span aria-hidden="true">❤️</span>
                            {formatNumber(tweet.favoriteCount)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-zinc-700 whitespace-pre-line dark:text-zinc-300">
                          {tweet.fullText || "Tweet content unavailable."}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    );
  }, [
    threadsLoading,
    hasThreadData,
    threadsError,
    hasVisibleThreads,
    visibleThreads,
    clusterNameMap,
    selectedCluster,
  ]);

  if (!summary) {
    return null;
  }

  return (
    <section className="flex flex-col gap-5 rounded-4xl bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
            Threads and Tweets
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleHideReplies}
              aria-pressed={hideReplies}
              className="inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:border-zinc-600"
            >
              <span
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  hideReplies ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    hideReplies ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </span>
              Hide Replies
            </button>
            <button
              type="button"
              onClick={toggleHideRetweets}
              aria-pressed={hideRetweets}
              className="inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:border-zinc-600"
            >
              <span
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  hideRetweets ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    hideRetweets ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </span>
              Hide Retweets
            </button>
            <button
              type="button"
              onClick={toggleHideIncompleteThreads}
              aria-pressed={hideIncompleteThreads}
              className="inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:border-zinc-600"
            >
              <span
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  hideIncompleteThreads ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    hideIncompleteThreads ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </span>
              Hide incomplete threads
            </button>
            <button
              type="button"
              title="Some conversation threads may be incomplete because not all tweets were captured in the archive."
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
              aria-label="Thread filters help"
            >
              i
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <label
              htmlFor={sortLabelId}
              className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
            >
              Sort by
            </label>
            <select
              id={sortLabelId}
              value={threadSortKey}
              onChange={(event) => setThreadSortKey(event.target.value as ThreadSortKey)}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-600"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setThreadSortAscending(!threadSortAscending)}
            aria-pressed={threadSortAscending}
            className="inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:border-zinc-600"
          >
            <span
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                threadSortAscending ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  threadSortAscending ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </span>
            Ascending order
          </button>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
          <span role="img" aria-hidden="true" className="mr-2">
            ↔️
          </span>
          Scroll to see more tweet threads. Only the longest thread starting at each root is displayed.
        </div>
      </div>

      {threadsError && hasThreadData && (
        <p className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
          {threadsError}
        </p>
      )}

      {body}
    </section>
  );
};
