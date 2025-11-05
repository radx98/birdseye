"use client";

import Image from "next/image";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThreadEntry } from "@/types/thread";
import { useUserExplorer } from "./context";
import { formatDate, formatHandle, formatNumber } from "./formatters";

export const OntologySection = () => {
  const {
    summary,
    clustersLoading,
    selectedCluster,
    hasAvailableClusters,
    threadsData,
    threadsLoading,
  } = useUserExplorer();

  const [referenceOpenMap, setReferenceOpenMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setReferenceOpenMap({});
  }, [selectedCluster?.id]);

  type ReferenceLookupValue = {
    tweetId: string;
    username: string;
    createdAt: string | null;
    fullText: string;
    favoriteCount: number;
    avatarUrl: string;
    thread?: ThreadEntry;
    threadLength?: number;
    isThreadRoot?: boolean;
  };

  const referenceLookup = useMemo<Map<string, ReferenceLookupValue>>(() => {
    const map = new Map<string, ReferenceLookupValue>();
    const ontologyDetails = selectedCluster?.ontologyTweetDetails ?? {};

    for (const [tweetId, detail] of Object.entries(ontologyDetails)) {
      map.set(tweetId, {
        tweetId,
        username: detail.username,
        createdAt: detail.createdAt ?? null,
        fullText: detail.fullText || "Tweet content unavailable.",
        favoriteCount: detail.favoriteCount ?? 0,
        avatarUrl: detail.avatarUrl || "/placeholder.jpg",
      });
    }

    const threads = threadsData?.threads ?? [];
    for (const thread of threads) {
      const threadLength = thread.tweets.length;
      thread.tweets.forEach((tweet, index) => {
        if (!tweet.id) {
          return;
        }
        const existing = map.get(tweet.id);
        map.set(tweet.id, {
          tweetId: tweet.id,
          username: tweet.username || existing?.username || "",
          createdAt: tweet.createdAt ?? existing?.createdAt ?? null,
          fullText: tweet.fullText || existing?.fullText || "Tweet content unavailable.",
          favoriteCount:
            Number.isFinite(tweet.favoriteCount) && tweet.favoriteCount !== undefined
              ? tweet.favoriteCount
              : existing?.favoriteCount ?? 0,
          avatarUrl: tweet.avatarUrl || existing?.avatarUrl || "/placeholder.jpg",
          thread,
          threadLength,
          isThreadRoot: index === 0,
        });
      });
    }

    return map;
  }, [selectedCluster, threadsData]);

  if (!summary) {
    return null;
  }

  const showLoading = clustersLoading && !hasAvailableClusters;
  const ontology = selectedCluster?.ontology;

  const renderCard = <T extends { id: string; tweetReferences: string[] }>(
    title: string,
    items: T[],
    getTitle: (item: T) => string,
    getDescription: (item: T) => string,
    emptyText: string,
  ) => {
    const hasItems = items.length > 0;

    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
          {title}
        </h3>
        {hasItems ? (
          <ul className="mt-3 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            {items.map((item, index) => {
              const primary = getTitle(item).trim();
              const secondary = getDescription(item).trim();
              const references = Array.isArray(item.tweetReferences) ? item.tweetReferences.length : 0;
              const key = item.id || `${title}-${index}`;
              const toggleKey = `${selectedCluster?.id ?? "cluster"}::${title}::${key}`;
              const isOpen = referenceOpenMap[toggleKey] ?? false;
              const contentId = `${toggleKey}-references`;

              const resolvedReferences = Array.isArray(item.tweetReferences)
                ? item.tweetReferences.map((referenceId) => ({
                    referenceId,
                    data: referenceLookup.get(referenceId),
                  }))
                : [];

              const hasResolvedContent = resolvedReferences.some((entry) => Boolean(entry.data));
              const showLoadingState =
                threadsLoading && references > 0 && resolvedReferences.every((entry) => !entry.data);

              const handleToggle = () => {
                if (references === 0) {
                  return;
                }
                setReferenceOpenMap((prev) => ({
                  ...prev,
                  [toggleKey]: !isOpen,
                }));
              };

              const buildTweetUrl = (referenceId: string, username: string | null | undefined) => {
                const handle = username ? username.replace(/^@/, "") : "";
                if (handle) {
                  return `https://x.com/${handle}/status/${referenceId}`;
                }
                return `https://x.com/i/web/status/${referenceId}`;
              };

              return (
                <li key={key} className="flex flex-col gap-2">
                  <p className="leading-relaxed">
                    {primary ? (
                      <span className="font-semibold text-zinc-800 dark:text-zinc-100">{primary}</span>
                    ) : null}
                    {primary && secondary ? <Fragment>&nbsp;—&nbsp;</Fragment> : null}
                    {secondary ? <span>{secondary}</span> : null}
                    {!primary && !secondary ? <span>No description available.</span> : null}
                  </p>
                  <button
                    type="button"
                    disabled={references === 0}
                    aria-disabled={references === 0}
                    onClick={handleToggle}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-500 disabled:cursor-not-allowed disabled:text-zinc-400 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <span aria-hidden="true">🔗</span>
                    <span>{`${references} ${references === 1 ? "reference" : "references"}`}</span>
                    {references > 0 ? (
                      <span aria-hidden="true" className="ml-1 text-[0.7rem] text-blue-500/80 dark:text-blue-300/80">
                        {isOpen ? "Hide" : "Show"}
                      </span>
                    ) : null}
                  </button>
                  {references > 0 && isOpen ? (
                    <div
                      id={contentId}
                      className="-mx-4 mt-2 p-2 flex w-[calc(100%+2rem)] flex-col gap-2 bg-white/80 text-sm text-zinc-600 transition-colors dark:bg-zinc-800/60 dark:text-zinc-200 sm:-mx-5 sm:w-[calc(100%+2.5rem)]"
                    >
                      {showLoadingState ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading reference tweets…</p>
                      ) : hasResolvedContent ? (
                        resolvedReferences.map(({ referenceId, data }) => {
                          if (!data) {
                            return (
                              <article
                                key={`missing-${referenceId}`}
                                className="rounded-lg border border-dashed border-zinc-200 bg-zinc-100/70 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
                              >
                                Reference tweet unavailable.
                              </article>
                            );
                          }

                          const threadLength =
                            data.threadLength ?? (data.thread ? data.thread.tweets.length : undefined);
                          const isThreadRoot =
                            data.isThreadRoot ?? (data.thread ? data.thread.tweets[0]?.id === referenceId : false);
                          const linkTarget = buildTweetUrl(referenceId, data.username);

                          return (
                            <article
                              key={referenceId}
                              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 text-left transition-colors dark:border-zinc-700"
                            >
                              <div className="flex items-start gap-3">
                                <Image
                                  src={data.avatarUrl}
                                  alt={data.username ? `Avatar of ${formatHandle(data.username)}` : "Tweet avatar"}
                                  width={36}
                                  height={36}
                                  className="h-9 w-9 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
                                />
                                <div className="flex flex-1 flex-col gap-2">
                                  <div className="flex items-baseline justify-between gap-3">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                                        {formatHandle(data.username) || "Unknown"}
                                      </span>
                                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {formatDate(data.createdAt)}
                                      </span>
                                    </div>
                                    <a
                                      href={linkTarget}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                                    >
                                      View
                                    </a>
                                  </div>
                                  <p className="text-sm leading-snug text-zinc-700 whitespace-pre-line dark:text-zinc-200">
                                    {data.fullText || "Tweet content unavailable."}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/70 px-2 py-0.5 font-medium dark:bg-zinc-800/70">
                                      <span aria-hidden="true">❤️</span>
                                      {formatNumber(data.favoriteCount)}
                                    </span>
                                    {typeof threadLength === "number" && threadLength > 0 ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/70 px-2 py-0.5 font-medium dark:bg-zinc-800/70">
                                        {threadLength === 1 ? "Single tweet" : `${threadLength} tweets in thread`}
                                      </span>
                                    ) : null}
                                    {isThreadRoot ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/70 px-2 py-0.5 font-medium dark:bg-zinc-800/70">
                                        Thread root
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Reference tweets are not available for this cluster yet.
                        </p>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{emptyText}</p>
        )}
      </div>
    );
  };

  let body: ReactNode;

  if (showLoading) {
    body = (
      <div className="flex items-center justify-center rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
          Loading ontology details…
        </span>
      </div>
    );
  } else if (!hasAvailableClusters || !selectedCluster) {
    body = (
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        Select a cluster to explore its ontology.
      </div>
    );
  } else if (!ontology) {
    body = (
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        Ontology data is not available for this cluster.
      </div>
    );
  } else {
    const hasAnyOntology =
      ontology.entities.length > 0 ||
      ontology.beliefsAndValues.length > 0 ||
      ontology.goals.length > 0 ||
      ontology.socialRelationships.length > 0 ||
      ontology.moodsAndEmotionalTones.length > 0 ||
      ontology.keyConcepts.length > 0;

    body = (
      <div className="flex flex-col gap-5">
        {!hasAnyOntology && (
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
            Ontology data was not provided for this cluster. Once it is available, key themes will appear below.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {renderCard(
            "Entities",
            ontology.entities,
            (item) => item.name || (item.id ? `Entity ${item.id}` : "Entity"),
            (item) => item.description,
            "No entities identified for this cluster.",
          )}
          {renderCard(
            "Beliefs & Values",
            ontology.beliefsAndValues,
            (item) => item.belief || (item.id ? `Belief ${item.id}` : "Belief"),
            (item) => item.description,
            "No beliefs or values identified for this cluster.",
          )}
          {renderCard(
            "Goals",
            ontology.goals,
            (item) => item.goal || (item.id ? `Goal ${item.id}` : "Goal"),
            (item) => item.description,
            "No goals identified for this cluster.",
          )}
          {renderCard(
            "Social Relationships",
            ontology.socialRelationships,
            (item) => formatHandle(item.username) || (item.id ? `Relationship ${item.id}` : "Relationship"),
            (item) => item.interactionType,
            "No social relationships identified for this cluster.",
          )}
          {renderCard(
            "Moods & Emotional Tones",
            ontology.moodsAndEmotionalTones,
            (item) => item.mood || (item.id ? `Mood ${item.id}` : "Mood"),
            (item) => item.description,
            "No moods or emotional tones identified for this cluster.",
          )}
          {renderCard(
            "Key Concepts",
            ontology.keyConcepts,
            (item) => item.concept || (item.id ? `Concept ${item.id}` : "Concept"),
            (item) => item.description,
            "No key concepts identified for this cluster.",
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div>
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
          Ontology
        </h2>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
        <span role="img" aria-hidden="true" className="mr-2">
          ↔️
        </span>
        We gathered some key features to help understand the topic all at once. You can click{" "}
        <span aria-hidden="true">🔗</span> references to see the tweets that inform them.
      </div>
      {body}
    </section>
  );
};
