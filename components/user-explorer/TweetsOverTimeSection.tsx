"use client";

import { useUserExplorer } from "./context";

export const TweetsOverTimeSection = () => {
  const { summary, clustersLoading } = useUserExplorer();

  if (!summary) {
    return null;
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div>
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
          Tweets over time
        </h2>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
        <span role="img" aria-hidden="true" className="mr-2">
          📈
        </span>
        Drag horizontally on the graph to filter tweets in the right column.
      </div>
      {clustersLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
            Loading...
          </span>
        </div>
      ) : (
        <div className="flex min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
          Timeline chart placeholder (data coming soon).
        </div>
      )}
    </section>
  );
};
