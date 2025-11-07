export type ClusterEmbeddingPoint = {
  tweetId: string;
  clusterId: string;
  x: number;
  y: number;
};

export type UserEmbeddings = {
  embeddings: ClusterEmbeddingPoint[];
  originalDimensions: number;
};
