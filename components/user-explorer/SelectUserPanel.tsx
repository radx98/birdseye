"use client";

import Image from "next/image";
import { type ChangeEvent } from "react";
import { useUserExplorer } from "./context";
import { formatNumber } from "./formatters";

type NumericSummaryKey = "tweets" | "following" | "followers" | "likes";

const STAT_LABELS: Array<{ key: NumericSummaryKey; label: string }> = [
  { key: "tweets", label: "Tweets" },
  { key: "following", label: "Following" },
  { key: "followers", label: "Followers" },
  { key: "likes", label: "Likes" },
];

export const SelectUserPanel = () => {
  const {
    selectOptions,
    selectedUser,
    hasUsers,
    listLoading,
    listError,
    summaryError,
    summary,
    expandLoading,
    handleSelection,
    handleExpand,
  } = useUserExplorer();

  const onSelectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    handleSelection(event.target.value);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex flex-1 flex-col">
          <select
            value={selectedUser}
            onChange={onSelectionChange}
            disabled={!hasUsers || listLoading}
            className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 pr-12 text-base text-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-600"
          >
            <option value="">
              {listLoading ? "Loading users…" : hasUsers ? "Choose a user" : "No users available"}
            </option>
            {selectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
            <Image
              src="/dropdown.png"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 opacity-80 filter dark:invert dark:brightness-125 dark:opacity-90"
            />
          </span>
        </div>
        <button
          type="button"
          onClick={handleExpand}
          disabled={!selectedUser || expandLoading}
          className="inline-flex min-w-[8rem] items-center justify-center rounded-lg bg-zinc-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {expandLoading ? "Loading…" : "Explore"}
        </button>
      </div>

      {!hasUsers && !listLoading && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          {listError ?? "User data is not available right now. Please try again later."}
        </p>
      )}

      {listError && hasUsers && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
          {listError}
        </p>
      )}

      {summaryError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
          {summaryError}
        </p>
      )}

      {summary && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="flex h-20 w-20 shrink-0 items-start justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
              <Image
                src={summary.avatarUrl}
                alt={`Avatar of ${summary.handle}`}
                width={80}
                height={80}
                className="h-20 w-20 object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1">
                <p className="font-slab text-xl font-semibold text-zinc-800 dark:text-zinc-100">{summary.handle}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {summary.description || "No description available."}
                </p>
              </div>
              <div className="inline-flex w-auto items-center gap-2 self-start rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
                <span role="img" aria-hidden="true">
                  📊
                </span>
                <span>
                  {formatNumber(summary.clusters)} {summary.clusters === 1 ? "cluster" : "clusters"}
                </span>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_LABELS.map(({ key, label }) => (
              <div
                key={key}
                className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-700 transition-colors dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
              >
                <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
                <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatNumber(summary[key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
