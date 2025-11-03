"use client";

import { useState, type ReactNode } from "react";
import { useUserExplorer } from "./context";

export const YearlySummariesSection = () => {
  const { summary, clustersLoading, selectedCluster, hasAvailableClusters } = useUserExplorer();
  const [activeIndexes, setActiveIndexes] = useState<Record<string, number>>({});

  if (!summary) {
    return null;
  }

  const clusterId = selectedCluster?.id ?? null;
  const yearlySummaries = selectedCluster?.yearlySummaries ?? [];
  const activeIndex = clusterId ? activeIndexes[clusterId] ?? 0 : 0;
  const hasEntries = yearlySummaries.length > 0;
  const showLoading = clustersLoading && !hasAvailableClusters;

  let body: ReactNode;

  if (showLoading) {
    body = (
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
          Loading yearly summaries…
        </span>
      </div>
    );
  } else if (!hasAvailableClusters || !selectedCluster) {
    body = (
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        Select a cluster to view its yearly evolution.
      </div>
    );
  } else if (!hasEntries) {
    body = (
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        No yearly summaries are available for this cluster.
      </div>
    );
  } else {
    const safeIndex = Math.min(activeIndex, yearlySummaries.length - 1);
    const activeEntry = yearlySummaries[safeIndex];
    const summaryText = activeEntry.summary || "No summary available for this period.";

    body = (
      <div className="flex flex-col gap-5">
        <div className="flex gap-3 overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-2 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60">
          {yearlySummaries.map((entry, index) => {
            const isActive = index === safeIndex;
            return (
              <button
                key={`${entry.period}-${index}`}
                type="button"
                onClick={() => {
                  if (!clusterId) return;
                  setActiveIndexes((prev) => {
                    if (prev[clusterId] === index) {
                      return prev;
                    }
                    return { ...prev, [clusterId]: index };
                  });
                }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {entry.period}
              </button>
            );
          })}
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 transition-colors dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
            {activeEntry.period}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{summaryText}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-4xl bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div>
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
          Yearly summaries
        </h2>
      </div>
      {body}
    </section>
  );
};
