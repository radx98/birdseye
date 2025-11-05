"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserExplorer, type ThreadSortKey } from "./context";
import { formatDate, formatHandle, formatNumber } from "./formatters";
import { extractTrailingTcoLinks } from "./text";

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

const buildTweetUrl = (tweetId: string, username: string | null | undefined) => {
  const handle = username ? username.replace(/^@/, "") : "";
  if (handle) {
    return `https://x.com/${handle}/status/${tweetId}`;
  }
  return `https://x.com/i/web/status/${tweetId}`;
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

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollShadows = useCallback(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = element;
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);

    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft < maxScrollLeft - 1);
  }, []);

  const visibleThreadCount = visibleThreads.length;

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    updateScrollShadows();

    const handleScroll = () => {
      updateScrollShadows();
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      element.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [updateScrollShadows, hasThreadData, hasVisibleThreads, visibleThreadCount]);

  useEffect(() => {
    const animationFrame = requestAnimationFrame(() => {
      updateScrollShadows();
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [updateScrollShadows, visibleThreadCount]);

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
        <div className="flex items-center justify-center rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
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
      <div className="relative pb-2">
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto pb-3"
          style={{ transform: "rotateX(180deg)" }}
        >
          <div
            className="flex items-start snap-x snap-mandatory gap-4"
            style={{ transform: "rotateX(180deg)" }}
          >
            {visibleThreads.map((thread) => {
              const threadClusterLabel =
                thread.clusterId && clusterNameMap.has(thread.clusterId)
                  ? clusterNameMap.get(thread.clusterId)!
                  : thread.clusterId || "Unassigned";

              return (
                <article
                  key={thread.id}
                  className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 flex-none w-[40%] max-w-[40%] snap-start"
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
                    {thread.tweets.map((tweet, index) => {
                      const { body: tweetBody, trailingLinks } = extractTrailingTcoLinks(tweet.fullText);
                      const hasTweetBody = Boolean(tweetBody && tweetBody.trim().length > 0);
                      const shouldShowFallback = !hasTweetBody && trailingLinks.length === 0;
                      const linkTarget = tweet.id ? buildTweetUrl(tweet.id, tweet.username) : null;

                      return (
                        <div key={tweet.id || `${thread.id}-${index}`} className="flex flex-col gap-3">
                          {index > 0 ? (
                            <div className="border-t border-dashed border-zinc-200 dark:border-zinc-700" aria-hidden="true" />
                          ) : null}
                          <article className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors dark:border-zinc-700 dark:bg-zinc-900">
                            <div className="flex items-start gap-3">
                              <Image
                                src={tweet.avatarUrl}
                                alt={tweet.username ? `Avatar of ${formatHandle(tweet.username)}` : "Avatar placeholder"}
                                width={36}
                                height={36}
                                className="h-9 w-9 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
                              />
                              <div className="flex flex-1 flex-col gap-2">
                                <div className="flex items-baseline justify-between gap-3">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                                      {formatHandle(tweet.username) || "Unknown"}
                                    </span>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {formatDate(tweet.createdAt)}
                                    </span>
                                  </div>
                                  {linkTarget ? (
                                    <a
                                      href={linkTarget}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                                    >
                                      View
                                    </a>
                                  ) : null}
                                </div>
                                {hasTweetBody ? (
                                  <p className="text-[0.75rem] leading-snug text-zinc-700 whitespace-pre-line dark:text-zinc-200">
                                    {tweetBody}
                                  </p>
                                ) : shouldShowFallback ? (
                                  <p className="text-[0.75rem] leading-snug text-zinc-700 whitespace-pre-line dark:text-zinc-200">
                                    Tweet content unavailable.
                                  </p>
                                ) : null}
                                {trailingLinks.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {trailingLinks.map((link) => (
                                      <a
                                        key={link}
                                        href={link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-zinc-600 transition hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100"
                                      >
                                        <span aria-hidden="true">📎</span>
                                        Tweet (view)
                                      </a>
                                    ))}
                                  </div>
                                ) : null}
                                <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/70 px-2 py-0.5 font-medium dark:bg-zinc-800/70">
                                    <span aria-hidden="true">❤️</span>
                                    {formatNumber(tweet.favoriteCount)}
                                  </span>
                                  {index === 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/70 px-2 py-0.5 font-medium dark:bg-zinc-800/70">
                                      Thread root
                                    </span>
                                  ) : null}
                                  {tweet.isReply ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/70 px-2 py-0.5 font-medium dark:bg-zinc-800/70">
                                      Reply
                                    </span>
                                  ) : null}
                                  {tweet.isRetweet ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/70 px-2 py-0.5 font-medium dark:bg-zinc-800/70">
                                      Retweet
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </article>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-black/10 via-black/5 to-transparent transition-opacity duration-300 dark:from-black/40 dark:via-black/20 dark:to-transparent ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.95) 15%, rgba(0, 0, 0, 0.95) 85%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.95) 15%, rgba(0, 0, 0, 0.95) 85%, transparent 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-black/10 via-black/5 to-transparent transition-opacity duration-300 dark:from-black/40 dark:via-black/20 dark:to-transparent ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
          style={{
            maskImage: "linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.95) 15%, rgba(0, 0, 0, 0.95) 85%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.95) 15%, rgba(0, 0, 0, 0.95) 85%, transparent 100%)",
          }}
        />
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
    canScrollLeft,
    canScrollRight,
  ]);

  if (!summary) {
    return null;
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
            Threads and Tweets
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center">
              <span className="mr-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Hide Replies</span>
              <button
                type="button"
                onClick={toggleHideReplies}
                aria-pressed={hideReplies}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  hideReplies ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span className="sr-only">Toggle hide replies</span>
                <span
                  className={`absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 transform rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${
                    hideReplies ? "translate-x-[16px]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center">
              <span className="mr-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Hide Retweets</span>
              <button
                type="button"
                onClick={toggleHideRetweets}
                aria-pressed={hideRetweets}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  hideRetweets ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span className="sr-only">Toggle hide retweets</span>
                <span
                  className={`absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 transform rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${
                    hideRetweets ? "translate-x-[16px]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center">
              <span className="mr-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Hide incomplete threads
              </span>
              <div className="relative mr-2 group">
                <button
                  type="button"
                  aria-describedby="incomplete-threads-tooltip"
                  className="flex h-3 w-3 items-center justify-center rounded-full border border-zinc-400 text-[0.55rem] font-semibold text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-500 dark:border-zinc-600 dark:text-zinc-500 dark:hover:border-zinc-500 dark:hover:text-zinc-400"
                  aria-label="Incomplete threads help"
                >
                  i
                </button>
                <div
                  id="incomplete-threads-tooltip"
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-4 hidden w-64 -translate-x-1/2 rounded-md bg-black px-3 py-2 text-xs leading-snug text-white shadow-md group-hover:flex group-focus-within:flex dark:bg-white dark:text-zinc-900"
                >
                  Some conversation threads may be incomplete because not all tweets were captured in the archive.
                </div>
              </div>
              <button
                type="button"
                onClick={toggleHideIncompleteThreads}
                aria-pressed={hideIncompleteThreads}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  hideIncompleteThreads ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span className="sr-only">Toggle hide incomplete threads</span>
                <span
                  className={`absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 transform rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${
                    hideIncompleteThreads ? "translate-x-[16px]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 justify-end">
          <div className="flex items-center">
            <label
              htmlFor={sortLabelId}
              className="mr-2 text-xs font-medium text-zinc-500 dark:text-zinc-400"
            >
              Sort by
            </label>
            <div className="relative">
              <select
                id={sortLabelId}
                value={threadSortKey}
                onChange={(event) => setThreadSortKey(event.target.value as ThreadSortKey)}
                className="h-8 appearance-none rounded-full border border-zinc-300 bg-white px-3 pr-8 text-xs font-medium text-zinc-700 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-0 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Image
                src="/dropdown.png"
                alt=""
                width={12}
                height={12}
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 opacity-70 transition-transform dark:invert"
              />
            </div>
          </div>
          <div className="flex items-center">
            <span className="mr-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Ascending order</span>
            <button
              type="button"
              onClick={() => setThreadSortAscending(!threadSortAscending)}
              aria-pressed={threadSortAscending}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                threadSortAscending ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <span className="sr-only">Toggle ascending order</span>
              <span
                className={`absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 transform rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${
                  threadSortAscending ? "translate-x-[16px]" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
          <span role="img" aria-hidden="true" className="mr-2">
            ↔️
          </span>
          Scroll to see more tweet threads. Only the longest thread starting at each root is displayed.
        </div>
      </div>

      {threadsError && hasThreadData && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
          {threadsError}
        </p>
      )}

      {body}
    </section>
  );
};
