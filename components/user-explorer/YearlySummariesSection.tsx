"use client";

import { useUserExplorer } from "./context";

const stripMarkdownLinks = (value?: string | null) =>
  value ? value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") : value ?? "";

export const YearlySummariesSection = () => {
  const { summary, clustersLoading, selectedCluster, hasAvailableClusters } = useUserExplorer();

  if (!summary) {
    return null;
  }

  const yearlySummaries = [...(selectedCluster?.yearlySummaries ?? [])].sort((a, b) => {
    const aDate = Date.parse(a.period ?? "");
    const bDate = Date.parse(b.period ?? "");
    if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
      return (b.period ?? "").localeCompare(a.period ?? "");
    }
    return bDate - aDate;
  });
  const hasEntries = yearlySummaries.length > 0;
  const showLoading = clustersLoading && !hasAvailableClusters;

  let body;

  if (showLoading) {
    body = (
      <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
          Loading...
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
    body = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {yearlySummaries.map((entry) => {
          const summaryText =
            stripMarkdownLinks(entry.summary) || "No summary available for this period.";

          return (
            <div
              key={entry.period}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60"
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                {entry.period}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{summaryText}</p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6 rounded-lg bg-white p-4 sm:p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div>
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
          Yearly summaries
        </h2>
      </div>
      {body}
    </section>
  );
};
