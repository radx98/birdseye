"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ClusterInfo, UserClusters } from "@/types/cluster";
import type { ThreadEntry, UserThreads } from "@/types/thread";
import type { UserSummary } from "@/types/user";

type SummaryCache = Map<string, UserSummary>;
type ClusterCache = Map<string, UserClusters>;
type ThreadCache = Map<string, UserThreads>;

export type ThreadSortKey = "favorite-count" | "date" | "cluster-probability";

export type ExplorerContextValue = {
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
  threadsData: UserThreads | null;
  threadsLoading: boolean;
  threadsError: string | null;
  handleSelection: (value: string) => void;
  handleExpand: () => Promise<void>;
  hideLowQuality: boolean;
  toggleHideLowQuality: () => void;
  filteredClusters: ClusterInfo[];
  selectedCluster: ClusterInfo | null;
  setSelectedClusterId: (id: string) => void;
  hasAvailableClusters: boolean;
  hideReplies: boolean;
  toggleHideReplies: () => void;
  hideRetweets: boolean;
  toggleHideRetweets: () => void;
  hideIncompleteThreads: boolean;
  toggleHideIncompleteThreads: () => void;
  threadSortKey: ThreadSortKey;
  setThreadSortKey: (key: ThreadSortKey) => void;
  threadSortAscending: boolean;
  setThreadSortAscending: (value: boolean) => void;
  visibleThreads: ThreadEntry[];
  hasThreadData: boolean;
  hasVisibleThreads: boolean;
};

const UserExplorerContext = createContext<ExplorerContextValue | null>(null);

type UserExplorerProviderProps = {
  users: string[];
  children: ReactNode;
};

export const UserExplorerProvider = ({ users, children }: UserExplorerProviderProps) => {
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
  const [threadsData, setThreadsData] = useState<UserThreads | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [hideReplies, setHideReplies] = useState(false);
  const [hideRetweets, setHideRetweets] = useState(false);
  const [hideIncompleteThreads, setHideIncompleteThreads] = useState(false);
  const [threadSortKey, setThreadSortKeyState] = useState<ThreadSortKey>("favorite-count");
  const [threadSortAscending, setThreadSortAscendingState] = useState(false);

  const summaryCacheRef = useRef<SummaryCache>(new Map());
  const clusterCacheRef = useRef<ClusterCache>(new Map());
  const threadCacheRef = useRef<ThreadCache>(new Map());

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
    setThreadsError(null);
    setSummary(null);
    setClustersData(null);
    setClustersLoading(false);
    setThreadsData(null);
    setThreadsLoading(false);
    setSelectedClusterId(null);
    setHideLowQuality(false);
    setHideReplies(false);
    setHideRetweets(false);
    setHideIncompleteThreads(false);
    setThreadSortKeyState("favorite-count");
    setThreadSortAscendingState(false);
  }, []);

  const handleExpand = useCallback(async () => {
    if (!selectedUser) return;

    const cacheKey = selectedUser;
    setExpandLoading(true);
    setSummaryError(null);
    setClustersError(null);
    setThreadsError(null);
    setClustersLoading(false);
    setThreadsLoading(false);

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
        setThreadsData(null);
        setThreadsLoading(false);
        return;
      }

      const loadClusters = async () => {
        const cachedClusters = clusterCacheRef.current.get(cacheKey);
        if (cachedClusters) {
          setClustersData(cachedClusters);
          setClustersLoading(false);
          return;
        }
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
      };

      const loadThreads = async () => {
        const cachedThreads = threadCacheRef.current.get(cacheKey);
        if (cachedThreads) {
          setThreadsData(cachedThreads);
          setThreadsLoading(false);
          return;
        }
        setThreadsData(null);
        setThreadsLoading(true);
        try {
          const res = await fetch(`/api/users/${encodeURIComponent(cacheKey)}/threads`, { cache: "no-store" });
          const data = await res.json();
          if (!res.ok) {
            const message = typeof data?.error === "string" ? data.error : "Unable to load threads.";
            throw new Error(message);
          }
          threadCacheRef.current.set(cacheKey, data);
          setThreadsData(data);
        } catch (error) {
          setThreadsData(null);
          setThreadsError(error instanceof Error ? error.message : "Unexpected error while loading threads.");
        } finally {
          setThreadsLoading(false);
        }
      };

      await Promise.all([loadClusters(), loadThreads()]);
    } finally {
      setExpandLoading(false);
    }
  }, [selectedUser]);

  const toggleHideLowQuality = useCallback(() => {
    setHideLowQuality((prev) => !prev);
  }, []);

  const toggleHideReplies = useCallback(() => {
    setHideReplies((prev) => !prev);
  }, []);

  const toggleHideRetweets = useCallback(() => {
    setHideRetweets((prev) => !prev);
  }, []);

  const toggleHideIncompleteThreads = useCallback(() => {
    setHideIncompleteThreads((prev) => !prev);
  }, []);

  const setThreadSortKey = useCallback((key: ThreadSortKey) => {
    setThreadSortKeyState(key);
  }, []);

  const setThreadSortAscending = useCallback((value: boolean) => {
    setThreadSortAscendingState(value);
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

  const visibleThreads = useMemo(() => {
    const baseList = threadsData?.threads ?? [];
    if (!baseList.length) {
      return [] as ThreadEntry[];
    }

    const clusterFilter = selectedCluster?.id ?? null;
    const applyFilters = baseList.filter((thread) => {
      if (clusterFilter && thread.clusterId !== clusterFilter) {
        return false;
      }
      if (hideIncompleteThreads && thread.isIncomplete) {
        return false;
      }
      if (hideReplies && thread.rootIsReply) {
        return false;
      }
      if (hideRetweets && thread.containsRetweet) {
        return false;
      }
      return true;
    });

    if (!applyFilters.length) {
      return [] as ThreadEntry[];
    }

    const toDateValue = (value: string | null) => {
      if (!value) return 0;
      const timestamp = Date.parse(value);
      return Number.isNaN(timestamp) ? 0 : timestamp;
    };

    const sorted = [...applyFilters].sort((a, b) => {
      const compareNumbers = (left: number, right: number) =>
        threadSortAscending ? left - right : right - left;

      let primary = 0;
      if (threadSortKey === "favorite-count") {
        primary = compareNumbers(a.totalFavorites ?? 0, b.totalFavorites ?? 0);
      } else if (threadSortKey === "date") {
        primary = compareNumbers(toDateValue(a.rootCreatedAt ?? null), toDateValue(b.rootCreatedAt ?? null));
      } else if (threadSortKey === "cluster-probability") {
        primary = compareNumbers(a.maxClusterProb ?? 0, b.maxClusterProb ?? 0);
      }

      if (primary !== 0) {
        return primary;
      }

      return compareNumbers(toDateValue(a.rootCreatedAt ?? null), toDateValue(b.rootCreatedAt ?? null));
    });

    return sorted;
  }, [
    threadsData,
    selectedCluster,
    hideIncompleteThreads,
    hideReplies,
    hideRetweets,
    threadSortKey,
    threadSortAscending,
  ]);

  const hasThreadData = Boolean(threadsData?.threads?.length);
  const hasVisibleThreads = visibleThreads.length > 0;

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
    threadsData,
    threadsLoading,
    threadsError,
    handleSelection,
    handleExpand,
    hideLowQuality,
    toggleHideLowQuality,
    filteredClusters,
    selectedCluster,
    setSelectedClusterId,
    hasAvailableClusters,
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
  };

  return <UserExplorerContext.Provider value={contextValue}>{children}</UserExplorerContext.Provider>;
};

export const useUserExplorer = () => {
  const context = useContext(UserExplorerContext);
  if (!context) {
    throw new Error("useUserExplorer must be used within a UserExplorerProvider.");
  }
  return context;
};
