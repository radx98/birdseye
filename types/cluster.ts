export type ClusterReplyStat = {
  username: string;
  count: number;
};

export type RelatedCluster = {
  id: string;
  name: string;
};

export type OntologyEntity = {
  id: string;
  name: string;
  description: string;
  tweetReferences: string[];
};

export type OntologyBelief = {
  id: string;
  belief: string;
  description: string;
  tweetReferences: string[];
};

export type OntologyGoal = {
  id: string;
  goal: string;
  description: string;
  tweetReferences: string[];
};

export type OntologyRelationship = {
  id: string;
  username: string;
  interactionType: string;
  tweetReferences: string[];
};

export type OntologyMood = {
  id: string;
  mood: string;
  description: string;
  tweetReferences: string[];
};

export type OntologyConcept = {
  id: string;
  concept: string;
  description: string;
  tweetReferences: string[];
};

export type YearlySummary = {
  period: string;
  summary: string;
};

export type ClusterOntology = {
  entities: OntologyEntity[];
  beliefsAndValues: OntologyBelief[];
  goals: OntologyGoal[];
  socialRelationships: OntologyRelationship[];
  moodsAndEmotionalTones: OntologyMood[];
  keyConcepts: OntologyConcept[];
};

export type ClusterOntologyReferenceTweet = {
  tweetId: string;
  username: string;
  accountId: string;
  createdAt: string | null;
  fullText: string;
  favoriteCount: number;
  avatarUrl: string;
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
  ontology: ClusterOntology;
  ontologyTweetDetails: Record<string, ClusterOntologyReferenceTweet>;
};

export type UserClusters = {
  clusters: ClusterInfo[];
};
