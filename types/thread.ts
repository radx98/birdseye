export type ThreadTweet = {
  id: string;
  username: string;
  createdAt: string | null;
  fullText: string;
  favoriteCount: number;
  clusterId: string;
  clusterProb: number;
  isReply: boolean;
  isRetweet: boolean;
};

export type ThreadEntry = {
  id: string;
  clusterId: string;
  isIncomplete: boolean;
  rootIsReply: boolean;
  containsRetweet: boolean;
  totalFavorites: number;
  rootCreatedAt: string | null;
  maxClusterProb: number;
  tweets: ThreadTweet[];
};

export type UserThreads = {
  threads: ThreadEntry[];
};
