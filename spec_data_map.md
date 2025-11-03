# Supabase Storage Data Map

This guide catalogs the datasets stored in the Supabase S3-compatible storage reachable with the credentials in `.env` and shows where each element lives inside a user's directory. It is intended for any client that needs to read the same data directly from that storage.

## Storage Layout

- Connect with any S3-compatible client using the Supabase endpoint (see `.env` credentials). The accessible storage exposes user directories directly at the root.
- User data lives directly under that root as directories named after the lowercase username, e.g. `/<username>/`.
- A user directory is considered ready when it contains the artifacts described below; one quick check is the presence of `cluster_ontology_items.json`. An additional optional metadata file, `clustering_params.json`, may also be present.
- Every path in this document is relative to the user directory, so prepend `/{username}/` when reading a file.

## Data Files and Elements

### `clustered_tweets_df.parquet`

- **Format**: Apache Parquet table.
- **Access**: read the file as a pandas or Arrow table, coercing timestamps (`created_at`) to `datetime`.
- **Purpose**: the master tweet table that powers cluster metrics, timelines, filters, and thread reconstruction.

| Column | Description | Example Uses |
| --- | --- | --- |
| `tweet_id` (string) | Canonical tweet identifier | Linking, thread construction, URL building |
| `username` (string) | Author screen name | Display names, reply filters |
| `account_id` (string) | Author numeric account id | Profile enrichment via external store |
| `created_at` (timestamp/iso string) | Creation time | Timeline charting, date-range filtering, yearly stats |
| `full_text` (string) | Tweet body | Text rendering, ontology summaries |
| `retweet_count` (int) | Retweet count | Engagement metrics |
| `favorite_count` (int) | Like count | Cluster stats, tweet ordering |
| `reply_to_tweet_id` (string) | Parent tweet id | Thread reconstruction, reply filters |
| `reply_to_user_id` / `reply_to_username` (string) | Parent account info | “Most replied to” lists, reply filtering |
| `conversation_id` (string) | Conversation root id | Thread grouping |
| `cluster` (string) | Assigned cluster id | Cluster filters, stats, selection |
| `cluster_prob` (float) | Membership probability | Thresholding low-confidence tweets |
| `emb_text` (string) | Embedding text snapshot | Embedding reuse |
| `quoted_tweet_id` (string) | Referenced quote tweet id | Quote lookup via `qts.pkl` |

### `labeled_cluster_hierarchy.parquet`

- **Format**: Apache Parquet table.
- **Purpose**: labeled cluster catalog with hierarchy information.
- **Key columns**:

| Column | Description | Example Uses |
| --- | --- | --- |
| `cluster_id` (string) | Cluster identifier. Level-0 clusters share ids with `clustered_tweets_df` | Row keys, selection |
| `parent` (string) | Parent id (`-1` for root, or group id like `1-A`) | Building parent→children map |
| `level` (int) | Hierarchy depth (`0` = cluster, `1` = group) | Filtering top-level clusters |
| `name` (string) | Human label | Cluster lists, buttons |
| `summary` (string) | Generated summary | Tooltip/description text |
| `low_quality_cluster` (string `"0"` / `"1"`) | Quality flag | “Hide low quality clusters” filtering |
| `selected_ids` (nullable) | Always `null` at save time | Can be ignored |

### `cluster_ontology_items.json`

- **Format**: JSON object keyed by cluster id (string).
- **Purpose**: ontology payload and summaries for each cluster.
- **Cluster entry structure** (`cluster_data = json[cluster_id]`):
  - `cluster_data["cluster_id"]`: string id (duplicates key).
  - `cluster_data["is_error"]`: labeling status flag.
  - `cluster_data["message"]`: raw LLM response (debugging).
  - `cluster_data["low_quality_cluster"]`: `"0"` or `"1"`; mirrors the hierarchy file.
  - `cluster_data["cluster_summary"]`: object with `name` and `summary` used in headings.
  - `cluster_data["ontology_items"]`: object containing the sections below.

| Section path | Value shape | Notes |
| --- | --- | --- |
| `["ontology_items"]["entities"]` | List of `{id, name, description, tweet_references[]}` | `tweet_references` uses local ids mapped via `local_tweet_id_maps.json` |
| `["ontology_items"]["beliefs_and_values"]` | List of `{id, belief, description, tweet_references[]}` | Beliefs & values section |
| `["ontology_items"]["goals"]` | List of `{id, goal, description, tweet_references[]}` | Goals section |
| `["ontology_items"]["social_relationships"]` | List of `{id, username, interaction_type, tweet_references[]}` | Social relationships list |
| `["ontology_items"]["moods_and_emotional_tones"]` | List of `{id, mood, description, tweet_references[]}` | Mood section |
| `["ontology_items"]["key_concepts_and_ideas"]` | List of `{id, concept, description, tweet_references[]}` | Concepts section |
| `["ontology_items"]["yearly_summaries"]` | List of `{period, summary}` | Year-based summaries |

### `local_tweet_id_maps.json`

- **Format**: JSON object keyed by cluster id, each value a map of local reference numbers to canonical tweet ids.
- **Usage**:
  - Resolve ontology references with `tweet_id = local_tweet_id_maps[cluster_id][local_ref]`.
  - `local_ref` keys are strings (`"1"`, `"2"`, …) due to JSON; values are tweet ids as strings.
  - Downstream consumers can convert these tweet ids to strings or integers as needed before highlighting tweets.

### `group_results.json`

- **Format**: JSON object describing higher-level groupings of clusters.
- **Structure**:
  - `groups`: list of group objects.
    - `name`: display label (often includes an emoji).
    - `reasoning`: text describing why the clusters were grouped.
    - `summary`: paragraph covering the group theme.
    - `members`: list of `{name, id}` where `id` matches `cluster_id`.
  - `overall_summary`: optional text summarizing the full archive.
- **Usage**:
  - Provide related-cluster suggestions or higher-level navigation.
  - Some pipelines append an “📦 Other Topics” entry at runtime for clusters that were not grouped; be prepared to handle that pattern.

### `trees.pkl` and `incomplete_trees.pkl`

- **Format**: Pickled Python dictionaries keyed by root tweet id (string).
- **Purpose**: canonical conversation trees used to render threads, including replies outside the primary selection.
- **Value schema** (`tree = trees[root_id]` or `incomplete_trees[root_id]`):
  - `tree["root"]`: root tweet id string.
  - `tree["tweets"]`: dict mapping tweet id string → normalized tweet dict containing:
    - `tweet_id`, `account_id`, `username`, `created_at`, `full_text`, `favorite_count`, `retweet_count`, `reply_to_tweet_id`, `reply_to_user_id`, `reply_to_username`, `conversation_id`, `archive_upload_id`.
  - `tree["children"]`: dict parent tweet id → list of child tweet ids.
  - `tree["parents"]`: dict child tweet id → parent tweet id.
  - `tree["paths"]`: dict leaf tweet id → list of tweet ids representing the root→leaf path.
- **Usage**:
  - Combine with filtered rows from `clustered_tweets_df.parquet` to build thread lanes.
  - `trees.pkl` contains full conversations; `incomplete_trees.pkl` adds partial conversations when available.
  - Account ids extracted from `tree["tweets"][tweet_id]["account_id"]` support subsequent profile lookups.

### `qts.pkl`

- **Format**: Pickled dict storing quote tweet metadata.
- **Structure** (`qts = pickle.load(...)`):
  - `qts["quote_map"]`: dict `quoting_tweet_id` → `quoted_tweet_id` (strings).
  - `qts["quoted_tweets"]`: dict `quoted_tweet_id` → tweet dict (normalized shape matching tree entries).
  - `qts["liked_quoted_tweets"]`: dict of additional quoted tweets recovered via liked-tweet lookups (same structure; may be empty).
- **Usage**:
  - Resolve quote relationships with `quoted_id = qts["quote_map"].get(tweet_id)`.
  - Pull tweet data from `qts["quoted_tweets"].get(quoted_id)` (fallback to `liked_quoted_tweets`) to populate quote content.
  - `quoted_tweet_id` values in `clustered_tweets_df.parquet` mirror these relationships for join convenience.

### `clustering_params.json` (optional)

- **Format**: JSON object containing the parameter search results from the clustering stage.
- **Typical fields**:
  - `min_cluster_size`, `min_samples`: integers selected for HDBSCAN.
  - `n_clusters`: number of non-noise clusters produced.
  - `noise_ratio`: fraction of points assigned to noise.
  - `persistence`: average cluster persistence reported by HDBSCAN.
  - `max_cluster_size`: size of the largest cluster.
  - `score`: optimization score used during parameter search.
  - `cluster_selection_method`: HDBSCAN selection method (`"eom"` or `"leaf"`).
  - `source`: string describing how the parameters were found (e.g. `"bayesian_optimization"`).
  - `results_df`: array of trial metrics captured during parameter search (each entry contains fields such as `min_cluster_size`, `min_samples`, `silhouette`, etc.).
- **Usage**:
  - Provides metadata for analytics or UI elements (such as expected cluster counts) without re-reading the Parquet tables.
  - If absent, derive cluster counts directly from `clustered_tweets_df.parquet` or `labeled_cluster_hierarchy.parquet`.

## Putting It Together

1. Enumerate available users by listing the bucket root prefixes and select a username directory.
2. Load `clustered_tweets_df.parquet` and `labeled_cluster_hierarchy.parquet` to build cluster tables, stats, and timelines.
3. When a cluster is selected, read `cluster_ontology_items.json` and `local_tweet_id_maps.json` for ontology content and tweet reference resolution.
4. Use `group_results.json` to surface related clusters and higher-level groupings.
5. For thread reconstruction, combine `trees.pkl` (and optionally `incomplete_trees.pkl`) with the filtered tweets, and enrich quote cards via `qts.pkl`.

All paths are shared across users and live directly under `/{username}/` inside the accessible Supabase storage root, so the same retrieval approach applies universally.
