"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import type { ClusterInfo, UserClusters } from "@/types/cluster";
import type { UserSummary } from "@/types/user";

type Props = {
  users: string[];
};

type SummaryCache = Map<string, UserSummary>;
type ClusterCache = Map<string, UserClusters>;
type NumericSummaryKey = "tweets" | "following" | "followers" | "likes";

const formatNumber = (value: number) => {
  if (Number.isNaN(value)) return "0";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return value.toLocaleString();
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
};

const formatHandle = (handle: string) => {
  if (!handle) return "";
  return handle.startsWith("@") ? handle : `@${handle}`;
};

const STAT_LABELS: Array<{ key: NumericSummaryKey; label: string }> = [
  { key: "tweets", label: "Tweets" },
  { key: "following", label: "Following" },
  { key: "followers", label: "Followers" },
  { key: "likes", label: "Likes" },
];

type ExplorerContextValue = {
  selectOptions: Array<{ value: string; label: string }>;
  selectedUser: string;
  hasUsers: boolean;
  listLoading: boolean;
  listError: string | null;
  summaryError: string | null;
  clustersError: string | null;
  summary: UserSummary | null;
  clustersData: UserClusters | null;
  clustersLoading: boolean;
  expandLoading: boolean;
  handleSelection: (value: string) => void;
  handleExpand: () => Promise<void>;
  hideLowQuality: boolean;
  toggleHideLowQuality: () => void;
  filteredClusters: ClusterInfo[];
  selectedCluster: ClusterInfo | null;
  setSelectedClusterId: (id: string) => void;
  hasAvailableClusters: boolean;
};

const UserExplorerContext = createContext<ExplorerContextValue | null>(null);

export const UserExplorerProvider = ({ users, children }: Props & { children: ReactNode }) => {
  const [options, setOptions] = useState(() => users);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [expandLoading, setExpandLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [clustersError, setClustersError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [clustersData, setClustersData] = useState<UserClusters | null>(null);
  const [clustersLoading, setClustersLoading] = useState(false);
  const [hideLowQuality, setHideLowQuality] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const summaryCacheRef = useRef<SummaryCache>(new Map());
  const clusterCacheRef = useRef<ClusterCache>(new Map());

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

  useEffect(() => {
    if (!clustersData) {
      setSelectedClusterId(null);
      return;
    }

    const baseList = hideLowQuality
      ? clustersData.clusters.filter((cluster) => !cluster.lowQuality)
      : clustersData.clusters;

    if (baseList.length === 0) {
      setSelectedClusterId(null);
      return;
    }

    if (!selectedClusterId || !baseList.some((cluster) => cluster.id === selectedClusterId)) {
      setSelectedClusterId(baseList[0].id);
    }
  }, [clustersData, hideLowQuality, selectedClusterId]);

  const hasUsers = options.length > 0;

  const selectOptions = useMemo(
    () => options.map((user) => ({ value: user, label: `@${user}` })),
    [options],
  );

  const handleSelection = useCallback((value: string) => {
    setSelectedUser(value);
    setSummaryError(null);
    setClustersError(null);
    setSummary(null);
    setClustersData(null);
    setClustersLoading(false);
    setSelectedClusterId(null);
    setHideLowQuality(false);
  }, []);

  const handleExpand = useCallback(async () => {
    if (!selectedUser) return;

    const cacheKey = selectedUser;
    setExpandLoading(true);
    setSummaryError(null);
    setClustersError(null);
    setClustersLoading(false);

    try {
      const cachedSummary = summaryCacheRef.current.get(cacheKey);
      let summaryLoadedSuccessfully = false;

      if (cachedSummary) {
        setSummary(cachedSummary);
        summaryLoadedSuccessfully = true;
      } else {
        try {
          const res = await fetch(`/api/users/${encodeURIComponent(cacheKey)}`, { cache: "no-store" });
          const data = await res.json();
          if (!res.ok) {
            const message = typeof data?.error === "string" ? data.error : "Unable to load user info.";
            throw new Error(message);
          }
          summaryCacheRef.current.set(cacheKey, data);
          setSummary(data);
          summaryLoadedSuccessfully = true;
        } catch (error) {
          setSummary(null);
          setSummaryError(error instanceof Error ? error.message : "Unexpected error while loading user info.");
        }
      }

      if (!summaryLoadedSuccessfully) {
        setClustersData(null);
        setClustersLoading(false);
        return;
      }

      const cachedClusters = clusterCacheRef.current.get(cacheKey);
      if (cachedClusters) {
        setClustersData(cachedClusters);
        setClustersLoading(false);
      } else {
        setClustersData(null);
        setClustersLoading(true);
        try {
          const res = await fetch(`/api/users/${encodeURIComponent(cacheKey)}/clusters`, { cache: "no-store" });
          const data = await res.json();
          if (!res.ok) {
            const message = typeof data?.error === "string" ? data.error : "Unable to load clusters.";
            throw new Error(message);
          }
          clusterCacheRef.current.set(cacheKey, data);
          setClustersData(data);
        } catch (error) {
          setClustersData(null);
          setClustersError(error instanceof Error ? error.message : "Unexpected error while loading clusters.");
        } finally {
          setClustersLoading(false);
        }
      }
    } finally {
      setExpandLoading(false);
    }
  }, [selectedUser]);

  const toggleHideLowQuality = useCallback(() => {
    setHideLowQuality((prev) => !prev);
  }, []);

  const filteredClusters: ClusterInfo[] = useMemo(() => {
    if (!clustersData) {
      return [];
    }
    return hideLowQuality ? clustersData.clusters.filter((cluster) => !cluster.lowQuality) : clustersData.clusters;
  }, [clustersData, hideLowQuality]);

  const selectedCluster = useMemo(() => {
    if (!filteredClusters.length) {
      return null;
    }
    if (selectedClusterId) {
      const match = filteredClusters.find((cluster) => cluster.id === selectedClusterId);
      if (match) {
        return match;
      }
    }
    return filteredClusters[0];
  }, [filteredClusters, selectedClusterId]);

  const hasAvailableClusters = filteredClusters.length > 0;

  const contextValue: ExplorerContextValue = {
    selectOptions,
    selectedUser,
    hasUsers,
    listLoading,
    listError,
    summaryError,
    clustersError,
    summary,
    clustersData,
    clustersLoading,
    expandLoading,
    handleSelection,
    handleExpand,
    hideLowQuality,
    toggleHideLowQuality,
    filteredClusters,
    selectedCluster,
    setSelectedClusterId,
    hasAvailableClusters,
  };

  return <UserExplorerContext.Provider value={contextValue}>{children}</UserExplorerContext.Provider>;
};

const useUserExplorer = () => {
  const context = useContext(UserExplorerContext);
  if (!context) {
    throw new Error("useUserExplorer must be used within a UserExplorerProvider.");
  }
  return context;
};

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
          onClick={handleExpand}
          disabled={!selectedUser || expandLoading}
          className="inline-flex min-w-[8rem] items-center justify-center rounded-2xl bg-zinc-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                  {selectedCluster.summary || "No summary available for this cluster."}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  Most replied to
                </h3>
                {selectedCluster.mostRepliedTo.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                    {selectedCluster.mostRepliedTo.map((entry) => (
                      <li key={entry.username}>
                        {formatHandle(entry.username)} ({formatNumber(entry.count)})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No reply data available.</p>
                )}
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                  Related Clusters
                </h3>
                {selectedCluster.relatedClusters.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                    {selectedCluster.relatedClusters.map((related) => (
                      <li key={related.id}>{related.name || related.id}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No related clusters available.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

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

export const TweetsOverTimeSection = () => {
  const { summary, clustersLoading } = useUserExplorer();

  if (!summary) {
    return null;
  }

  return (
    <section className="flex flex-col gap-5 rounded-4xl bg-white p-8 ring-1 ring-zinc-200 transition-colors dark:bg-zinc-900 dark:ring-zinc-700">
      <div>
        <h2 className="font-slab text-lg font-semibold text-zinc-800 transition-colors dark:text-zinc-100">
          Tweets over time
        </h2>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 transition-colors dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
        <span role="img" aria-hidden="true" className="mr-2">
          📈
        </span>
        Drag horizontally on the graph to filter tweets in the right column.
      </div>
      {clustersLoading ? (
        <div className="flex items-center justify-center rounded-3xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-ping rounded-full bg-zinc-400 dark:bg-zinc-500" aria-hidden="true" />
            Loading timeline data…
          </span>
        </div>
      ) : (
        <div className="flex min-h-[16rem] items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 text-sm text-zinc-600 transition-colors dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
          Timeline chart placeholder (data coming soon).
        </div>
      )}
    </section>
  );
};
