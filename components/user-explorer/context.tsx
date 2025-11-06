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
export type TimelineRange = { start: string; end: string };

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
  timelineRange: TimelineRange | null;
  setTimelineRange: (range: TimelineRange | null) => void;
};

const UserExplorerContext = createContext<ExplorerContextValue | null>(null);

const getThreadTopFavoriteCount = (thread: ThreadEntry): number => {
  if (!thread?.tweets?.length) {
    return 0;
  }
  let max = 0;
  for (const tweet of thread.tweets) {
    const candidate = Number.isFinite(tweet.favoriteCount) ? tweet.favoriteCount : 0;
    if (candidate > max) {
      max = candidate;
    }
  }
  return max;
};

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
  const [timelineRange, setTimelineRangeState] = useState<TimelineRange | null>(null);

  const summaryCacheRef = useRef<SummaryCache>(new Map());
  const clusterCacheRef = useRef<ClusterCache>(new Map());
  const threadCacheRef = useRef<ThreadCache>(new Map());
  const activeUserRef = useRef<string>("");

  useEffect(() => {
    setOptions(users);
    if (selectedUser && !users.includes(selectedUser)) {
      setSelectedUser("");
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
    activeUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      return;
    }
    setExpandLoading(false);
    setSummary(null);
    setSummaryError(null);
    setClustersData(null);
    setClustersLoading(false);
    setClustersError(null);
    setThreadsData(null);
    setThreadsLoading(false);
    setThreadsError(null);
    setSelectedClusterId(null);
    setHideLowQuality(false);
    setHideReplies(false);
    setHideRetweets(false);
    setHideIncompleteThreads(false);
    setThreadSortKeyState("favorite-count");
    setThreadSortAscendingState(false);
    setTimelineRangeState(null);
  }, [selectedUser]);

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
    setExpandLoading(false);
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
    setTimelineRangeState(null);
  }, []);

  const loadUserData = useCallback(
    async (username: string) => {
      if (!username) {
        return;
      }

      const isCurrentSelection = () => activeUserRef.current === username;
      if (!isCurrentSelection()) {
        return;
      }

      setExpandLoading(true);
      setSummaryError(null);
      setClustersError(null);
      setThreadsError(null);

      const cachedSummary = summaryCacheRef.current.get(username) ?? null;
      const cachedClusters = clusterCacheRef.current.get(username) ?? null;
      const cachedThreads = threadCacheRef.current.get(username) ?? null;
      const hasCompleteCache = Boolean(cachedSummary && cachedClusters && cachedThreads);

      setSummary(cachedSummary);
      setClustersData(cachedClusters);
      setThreadsData(cachedThreads);
      setClustersLoading(!cachedClusters);
      setThreadsLoading(!cachedThreads);

      if (hasCompleteCache) {
        setExpandLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/bundle`, { cache: "no-store" });
        const data = await res.json();
        if (!isCurrentSelection()) {
          return;
        }
        if (!res.ok) {
          const message =
            typeof data?.error === "string" ? data.error : "Unexpected error while loading user data.";
          setSummary(null);
          setClustersData(null);
          setThreadsData(null);
          summaryCacheRef.current.delete(username);
          clusterCacheRef.current.delete(username);
          threadCacheRef.current.delete(username);
          setSummaryError(message);
          setClustersError(message);
          setThreadsError(message);
          return;
        }

        if (data.summary) {
          summaryCacheRef.current.set(username, data.summary);
          setSummary(data.summary);
        } else {
          summaryCacheRef.current.delete(username);
          setSummary(null);
        }

        if (data.clusters) {
          clusterCacheRef.current.set(username, data.clusters);
          setClustersData(data.clusters);
        } else {
          clusterCacheRef.current.delete(username);
          setClustersData(null);
        }

        if (data.threads) {
          threadCacheRef.current.set(username, data.threads);
          setThreadsData(data.threads);
        } else {
          threadCacheRef.current.delete(username);
          setThreadsData(null);
        }
      } catch (error) {
        if (!isCurrentSelection()) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Unexpected error while loading user data.";
        setSummary(null);
        setClustersData(null);
        setThreadsData(null);
        summaryCacheRef.current.delete(username);
        clusterCacheRef.current.delete(username);
        threadCacheRef.current.delete(username);
        setSummaryError(message);
        setClustersError(message);
        setThreadsError(message);
      } finally {
        if (!isCurrentSelection()) {
          return;
        }
        setClustersLoading(false);
        setThreadsLoading(false);
        setExpandLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedUser) {
      return;
    }
    void loadUserData(selectedUser);
  }, [selectedUser, loadUserData]);

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

  const setTimelineRange = useCallback((range: TimelineRange | null) => {
    setTimelineRangeState(range);
  }, []);

  const monthBounds = useMemo(() => {
    if (!timelineRange) {
      return null;
    }

    const getMonthStart = (value: string) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return null;
      }
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    };

    const start = getMonthStart(timelineRange.start);
    const end = getMonthStart(timelineRange.end);
    if (start === null || end === null) {
      return null;
    }

    const lower = Math.min(start, end);
    const upper = Math.max(start, end);

    const upperDate = new Date(upper);
    const upperExclusive = Date.UTC(upperDate.getUTCFullYear(), upperDate.getUTCMonth() + 1, 1);

    return {
      start: lower,
      endExclusive: upperExclusive,
    };
  }, [timelineRange]);

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

    const applyTimelineFilter = (threads: ThreadEntry[]): ThreadEntry[] => {
      if (!monthBounds) {
        return threads;
      }

      const filteredThreads: ThreadEntry[] = [];
      for (const thread of threads) {
        const tweetsInRange = thread.tweets.filter((tweet) => {
          if (!tweet.createdAt) {
            return false;
          }
          const timestamp = Date.parse(tweet.createdAt);
          if (Number.isNaN(timestamp)) {
            return false;
          }
          return timestamp >= monthBounds.start && timestamp < monthBounds.endExclusive;
        });

        if (!tweetsInRange.length) {
          continue;
        }

        let totalFavorites = 0;
        let maxClusterProb = 0;
        let containsRetweet = false;

        for (const tweet of tweetsInRange) {
          if (Number.isFinite(tweet.favoriteCount)) {
            totalFavorites += tweet.favoriteCount;
          }
          if (Number.isFinite(tweet.clusterProb) && tweet.clusterProb > maxClusterProb) {
            maxClusterProb = tweet.clusterProb;
          }
          if (tweet.isRetweet) {
            containsRetweet = true;
          }
        }

        const firstTweet = tweetsInRange[0] ?? null;

        filteredThreads.push({
          ...thread,
          tweets: tweetsInRange,
          totalFavorites,
          maxClusterProb,
          containsRetweet,
          rootCreatedAt: firstTweet?.createdAt ?? thread.rootCreatedAt,
          rootIsReply: firstTweet?.isReply ?? thread.rootIsReply,
        });
      }

      return filteredThreads;
    };

    const filteredByTimeline = applyTimelineFilter(applyFilters);

    if (!filteredByTimeline.length) {
      return [] as ThreadEntry[];
    }

    const toDateValue = (value: string | null) => {
      if (!value) return 0;
      const timestamp = Date.parse(value);
      return Number.isNaN(timestamp) ? 0 : timestamp;
    };

    const sorted = [...filteredByTimeline].sort((a, b) => {
      const compareNumbers = (left: number, right: number) =>
        threadSortAscending ? left - right : right - left;

      let primary = 0;
      if (threadSortKey === "favorite-count") {
        primary = compareNumbers(getThreadTopFavoriteCount(a), getThreadTopFavoriteCount(b));
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
    monthBounds,
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
    timelineRange,
    setTimelineRange,
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
