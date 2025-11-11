export type UserTweetsOverTimePoint = {
  month: string;
  count: number;
};

export type UserSummary = {
  username: string;
  handle: string;
  description: string;
  clusters: number;
  tweets: number;
  followers: number;
  following: number;
  likes: number;
  avatarUrl: string;
  tweetsOverTime: UserTweetsOverTimePoint[];
  accountId: string; // Twitter account ID for linking to auth
};
