"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UserSummary } from "@/types/user";

type Props = {
  users: string[];
};

type SummaryCache = Map<string, UserSummary>;
type NumericSummaryKey = "tweets" | "following" | "followers" | "likes";

const formatNumber = (value: number) => {
  if (Number.isNaN(value)) return "0";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\\.0$/, "")}K`;
  }
  return value.toLocaleString();
};

const STAT_LABELS: Array<{ key: NumericSummaryKey; label: string }> = [
  { key: "tweets", label: "Tweets" },
  { key: "following", label: "Following" },
  { key: "followers", label: "Followers" },
  { key: "likes", label: "Likes" },
];

const UserExplorer = ({ users }: Props) => {
  const [options, setOptions] = useState(() => users);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const cacheRef = useRef<SummaryCache>(new Map());

  useEffect(() => {
    setOptions(users);
    if (users.length > 0 && !selectedUser) {
      setSelectedUser(users[0]);
    }
  }, [users, selectedUser]);

  useEffect(() => {
    if (users.length !== 0) {
      return;
    }

    let cancelled = false;

    const loadUsers = async () => {
      setListLoading(true);
      setListError(null);
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          const message = typeof data?.error === "string" ? data.error : "Unable to load users.";
          throw new Error(message);
        }
        const fetchedUsers = Array.isArray(data?.users) ? data.users.map(String) : [];
        if (!cancelled) {
          setOptions(fetchedUsers);
          if (fetchedUsers.length > 0) {
            setSelectedUser(fetchedUsers[0]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : "Unexpected error while loading users.");
        }
      } finally {
        if (!cancelled) {
          setListLoading(false);
        }
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [users]);

  const hasUsers = options.length > 0;
  const selectOptions = useMemo(
    () => options.map((user) => ({ value: user, label: `@${user}` })),
    [options],
  );

  const handleSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedUser(event.target.value);
    setSummaryError(null);
    setSummary(null);
  };

  const fetchSummary = async () => {
    if (!selectedUser) return;

    const cached = cacheRef.current.get(selectedUser);
    if (cached) {
      setSummary(cached);
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(selectedUser)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Unable to load user info.";
        throw new Error(message);
      }
      cacheRef.current.set(selectedUser, data);
      setSummary(data);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Unexpected error while loading user info.");
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex flex-1 flex-col">
          <select
            value={selectedUser}
            onChange={handleSelection}
            disabled={!hasUsers || listLoading}
            className="w-full appearance-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 pr-12 text-base text-zinc-900 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-600"
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
          onClick={fetchSummary}
          disabled={!selectedUser || summaryLoading}
          className="inline-flex min-w-[8rem] items-center justify-center rounded-2xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {summaryLoading ? "Loading…" : "Expand"}
        </button>
      </div>

      {!hasUsers && !listLoading && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          {listError ?? "User data is not available right now. Please try again later."}
        </p>
      )}

      {listError && hasUsers && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
          {listError}
        </p>
      )}

      {summaryError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200">
          {summaryError}
        </p>
      )}

      {summary && (
        <section className="flex flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition-colors dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
              <Image
                src={summary.avatarUrl}
                alt={`Avatar of ${summary.handle}`}
                width={80}
                height={80}
                className="h-20 w-20 object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-1">
                <p className="font-slab text-xl font-semibold text-zinc-800 dark:text-zinc-100">{summary.handle}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {summary.description || "No description available."}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
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
                className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-700 transition-colors dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
              >
                <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
                <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatNumber(summary[key])}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default UserExplorer;
