export type ClusterReplyStat = {
  username: string;
  count: number;
};

export type RelatedCluster = {
  id: string;
  name: string;
};

export type YearlySummary = {
  period: string;
  summary: string;
};

export type ClusterInfo = {
  id: string;
  name: string;
  summary: string;
  lowQuality: boolean;
  tweetsCount: number;
  medianLikes: number;
  totalLikes: number;
  medianDate: string | null;
  tweetsPerMonthLabel: string;
  mostRepliedTo: ClusterReplyStat[];
  relatedClusters: RelatedCluster[];
  yearlySummaries: YearlySummary[];
};

export type UserClusters = {
  clusters: ClusterInfo[];
};
