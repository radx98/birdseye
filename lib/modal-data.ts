import { ModalClient, Sandbox } from "modal";
import type { UserClusters } from "@/types/cluster";
import type { UserSummary } from "@/types/user";

type SandboxRunner<T> = (sandbox: Sandbox, mountPath: string) => Promise<T>;

const MODAL_TOKEN_ID = process.env.MODAL_TOKEN_ID;
const MODAL_TOKEN_SECRET = process.env.MODAL_TOKEN_SECRET;
const MODAL_APP_NAME = process.env.MODAL_APP_NAME ?? "birdseye-app";
const MODAL_VOLUME_NAME = process.env.MODAL_VOLUME_NAME ?? "twitter-archive-data";
const SANDBOX_IMAGE = process.env.MODAL_SANDBOX_IMAGE ?? "python:3.11-slim";
const VOLUME_MOUNT_PATH = "/mnt/vol";

if (!MODAL_TOKEN_ID || !MODAL_TOKEN_SECRET) {
  throw new Error("Missing Modal credentials. Ensure MODAL_TOKEN_ID and MODAL_TOKEN_SECRET are set.");
}

const runInSandbox = async <T>(runner: SandboxRunner<T>) => {
  const modal = new ModalClient({
    tokenId: MODAL_TOKEN_ID,
    tokenSecret: MODAL_TOKEN_SECRET,
  });

  try {
    const app = await modal.apps.fromName(MODAL_APP_NAME, { createIfMissing: true });
    const volume = await modal.volumes.fromName(MODAL_VOLUME_NAME);
    const image = modal.images.fromRegistry(SANDBOX_IMAGE);

    const sandbox = await modal.sandboxes.create(app, image, {
      volumes: {
        [VOLUME_MOUNT_PATH]: volume,
      },
      timeoutMs: 60_000,
      idleTimeoutMs: 15_000,
    });

    try {
      return await runner(sandbox, VOLUME_MOUNT_PATH);
    } finally {
      await sandbox.terminate().catch(() => undefined);
    }
  } finally {
    modal.close();
  }
};

const execPythonJSON = async (sandbox: Sandbox, script: string, args: string[]): Promise<unknown> => {
  const proc = await sandbox.exec(
    ["python3", "-c", script, ...args],
    {
      mode: "text",
    },
  );

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.wait(),
    proc.stdout.readText(),
    proc.stderr.readText(),
  ]);

  if (exitCode !== 0) {
    const error = stderr.trim() || stdout.trim() || `Python exited with code ${exitCode}`;
    throw new Error(error);
  }

  const payload = stdout.trim();
  if (!payload) {
    return null;
  }

  return JSON.parse(payload);
};

const installClusterDependencies = async (sandbox: Sandbox) => {
  const proc = await sandbox.exec(
    ["pip", "install", "--quiet", "pandas", "pyarrow"],
    {
      mode: "text",
    },
  );

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.wait(),
    proc.stdout.readText(),
    proc.stderr.readText(),
  ]);

  if (exitCode !== 0) {
    const message = stderr.trim() || stdout.trim() || `Failed to install dependencies (exit code ${exitCode})`;
    throw new Error(message);
  }
};

export const listVolumeUsers = async (): Promise<string[]> => {
  return runInSandbox(async (sandbox, mountPath) => {
    const script = `
import json
import os
import sys

root = sys.argv[1]
users = []
for name in os.listdir(root):
    if name.startswith('.'):
        continue
    path = os.path.join(root, name)
    if os.path.isdir(path):
        users.append(name)

users.sort()
print(json.dumps(users))
    `;

    const result = await execPythonJSON(sandbox, script, [mountPath]);
    return Array.isArray(result) ? result.map(String) : [];
  });
};

export const getUserSummary = async (username: string): Promise<UserSummary | null> => {
  const cleanUsername = username.replace(/^@/, "").trim();
  if (!cleanUsername) {
    return null;
  }

  return runInSandbox(async (sandbox, mountPath) => {
    const script = `
import json
import os
import pickle
import sys
from collections import Counter

root = sys.argv[1]
user = sys.argv[2]
user_path = os.path.join(root, user)

if not os.path.isdir(user_path):
    print(json.dumps({"__error__": "not-found"}))
    sys.exit(0)

group_file = os.path.join(user_path, "group_results.json")
clusters_file = os.path.join(user_path, "clustering_params.json")
trees_file = os.path.join(user_path, "trees.pkl")
tweet_map_file = os.path.join(user_path, "local_tweet_id_maps.json")

description = ""
if os.path.exists(group_file):
    try:
        with open(group_file, "r", encoding="utf-8") as handle:
            group_data = json.load(handle)
            summary = group_data.get("overall_summary") or ""
            description = " ".join(summary.split())
    except Exception:
        description = ""

clusters = 0
if os.path.exists(clusters_file):
    try:
        with open(clusters_file, "r", encoding="utf-8") as handle:
            cluster_data = json.load(handle)
            clusters = int(cluster_data.get("n_clusters") or 0)
    except Exception:
        clusters = 0

tweets = 0
followers = set()
following = set()
likes = 0
primary_account = None

if os.path.exists(trees_file):
    try:
        with open(trees_file, "rb") as handle:
            trees = pickle.load(handle)

        account_counts = Counter()
        for node in trees.values():
            for tweet in node.get("tweets", {}).values():
                account_id = tweet.get("account_id")
                if account_id:
                    account_counts[account_id] += 1

        if account_counts:
            primary_account = account_counts.most_common(1)[0][0]
            for node in trees.values():
                for tweet in node.get("tweets", {}).values():
                    account_id = tweet.get("account_id")
                    reply_to = tweet.get("reply_to_user_id")
                    if account_id == primary_account:
                        tweets += 1
                        fav = tweet.get("favorite_count") or 0
                        likes += int(fav)
                        if reply_to and reply_to != primary_account:
                            following.add(reply_to)
                    else:
                        if reply_to == primary_account and account_id:
                            followers.add(account_id)
    except Exception:
        tweets = likes = 0
        followers = set()
        following = set()

if tweets == 0 and os.path.exists(tweet_map_file):
    try:
        with open(tweet_map_file, "r", encoding="utf-8") as handle:
            mapping = json.load(handle)
        tweets = len({tweet_id for cluster in mapping.values() for tweet_id in cluster.values()})
    except Exception:
        tweets = 0

result = {
    "description": description,
    "clusters": clusters,
    "tweets": tweets,
    "followers": len(followers),
    "following": len(following),
    "likes": likes,
}

print(json.dumps(result))
    `;

    const payload = await execPythonJSON(sandbox, script, [mountPath, cleanUsername]);
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const record = payload as Record<string, unknown>;
    if (typeof record.__error__ === "string") {
      return null;
    }

    const handle = `@${cleanUsername}`;
    const avatarUrl = `https://unavatar.io/twitter/${cleanUsername}`;

    const toNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
    const toString = (value: unknown) => (typeof value === "string" ? value : "");

    return {
      username: cleanUsername,
      handle,
      description: toString(record.description),
      clusters: toNumber(record.clusters),
      tweets: toNumber(record.tweets),
      followers: toNumber(record.followers),
      following: toNumber(record.following),
      likes: toNumber(record.likes),
      avatarUrl,
    };
  });
};

export const getUserClusters = async (username: string): Promise<UserClusters | null> => {
  const cleanUsername = username.replace(/^@/, "").trim();
  if (!cleanUsername) {
    return null;
  }

  return runInSandbox(async (sandbox, mountPath) => {
    const script = `
import json
import math
import os
import sys
from collections import defaultdict

def normalize_yearly(entries):
    bucket = []
    if isinstance(entries, list):
        for item in entries:
            if not isinstance(item, dict):
                continue
            period = item.get("period")
            summary = item.get("summary")
            if not isinstance(period, str):
                period = ""
            if not isinstance(summary, str):
                summary = ""
            if not period and not summary:
                continue
            bucket.append({
                "period": period,
                "summary": summary,
            })
    return bucket

try:
    import pandas as pd
except Exception:
    print(json.dumps({"__error__": "missing-dependency"}))
    sys.exit(0)

root = sys.argv[1]
user = sys.argv[2]
user_path = os.path.join(root, user)

if not os.path.isdir(user_path):
    print(json.dumps({"__error__": "not-found"}))
    sys.exit(0)

hierarchy_path = os.path.join(user_path, "labeled_cluster_hierarchy.parquet")
tweets_path = os.path.join(user_path, "clustered_tweets_df.parquet")
groups_path = os.path.join(user_path, "group_results.json")
ontology_path = os.path.join(user_path, "cluster_ontology_items.json")
labels_path = os.path.join(user_path, "cluster_labels.json")

if not os.path.exists(hierarchy_path) or not os.path.exists(tweets_path):
    print(json.dumps({"clusters": []}))
    sys.exit(0)

try:
    hierarchy_df = pd.read_parquet(
        hierarchy_path,
        columns=["cluster_id", "name", "summary", "low_quality_cluster", "level"],
    )
except Exception:
    print(json.dumps({"__error__": "hierarchy-read"}))
    sys.exit(0)

hierarchy_df = hierarchy_df[hierarchy_df["level"] == 0].copy()
if hierarchy_df.empty:
    print(json.dumps({"clusters": []}))
    sys.exit(0)

hierarchy_df["cluster_id"] = hierarchy_df["cluster_id"].astype(str)
cluster_ids = set(hierarchy_df["cluster_id"].tolist())
name_map = {row.cluster_id: (row.name if isinstance(row.name, str) else row.cluster_id) for row in hierarchy_df.itertuples()}

yearly_map = {}

if os.path.exists(ontology_path):
    try:
        with open(ontology_path, "r", encoding="utf-8") as handle:
            ontology_data = json.load(handle)
        if isinstance(ontology_data, dict):
            for key, value in ontology_data.items():
                entry = value if isinstance(value, dict) else {}
                cluster_key = entry.get("cluster_id")
                if isinstance(cluster_key, str) and cluster_key:
                    cluster_key_str = cluster_key
                else:
                    cluster_key_str = str(key)
                if not cluster_key_str or cluster_key_str not in cluster_ids:
                    continue
                container = entry.get("ontology_items") if isinstance(entry.get("ontology_items"), dict) else entry
                raw_list = container.get("yearly_summaries")
                bucket = normalize_yearly(raw_list)
                if bucket:
                    yearly_map[cluster_key_str] = bucket
    except Exception:
        yearly_map = {}

if not yearly_map and os.path.exists(labels_path):
    try:
        with open(labels_path, "r", encoding="utf-8") as handle:
            label_data = json.load(handle)
        if isinstance(label_data, dict):
            for key, value in label_data.items():
                entry = value if isinstance(value, dict) else {}
                cluster_key = entry.get("cluster_id")
                if isinstance(cluster_key, str) and cluster_key:
                    cluster_key_str = cluster_key
                else:
                    cluster_key_str = str(key)
                if (
                    not cluster_key_str
                    or cluster_key_str in yearly_map
                    or cluster_key_str not in cluster_ids
                ):
                    continue
                raw_list = entry.get("yearly_summaries")
                bucket = normalize_yearly(raw_list)
                if bucket:
                    yearly_map[cluster_key_str] = bucket
    except Exception:
        pass

tweet_columns = ["cluster", "favorite_count", "created_at", "reply_to_username"]
try:
    tweets_df = pd.read_parquet(tweets_path, columns=tweet_columns)
except Exception:
    print(json.dumps({"__error__": "tweets-read"}))
    sys.exit(0)

tweets_df["cluster"] = tweets_df["cluster"].astype(str)
tweets_df = tweets_df[tweets_df["cluster"].isin(cluster_ids)].copy()

if tweets_df.empty:
    clusters = []
    for row in hierarchy_df.itertuples():
        clusters.append({
            "id": row.cluster_id,
            "name": row.name if isinstance(row.name, str) else row.cluster_id,
            "summary": row.summary if isinstance(row.summary, str) else "",
            "low_quality": str(row.low_quality_cluster) == "1",
            "tweets_count": 0,
            "total_likes": 0,
            "median_likes": 0,
            "median_date": None,
            "tweets_per_month": "placeholder",
            "most_replied_to": [],
            "related_clusters": [],
            "yearly_summaries": yearly_map.get(row.cluster_id, []),
        })

    clusters.sort(key=lambda item: item["name"])
    print(json.dumps({"clusters": clusters}))
    sys.exit(0)

tweets_df["favorite_count"] = pd.to_numeric(tweets_df["favorite_count"], errors="coerce").fillna(0)
tweets_df["created_at"] = pd.to_datetime(tweets_df["created_at"], errors="coerce", utc=True)
tweets_df["reply_to_username"] = tweets_df["reply_to_username"].fillna("").astype(str)

stats_df = tweets_df.groupby("cluster").agg(
    tweets_count=("favorite_count", "size"),
    total_likes=("favorite_count", "sum"),
    median_likes=("favorite_count", "median"),
)

stats_map = {}
for item in stats_df.itertuples():
    stats_map[item.Index] = {
        "tweets_count": int(item.tweets_count),
        "total_likes": float(item.total_likes),
        "median_likes": float(item.median_likes) if not math.isnan(float(item.median_likes)) else 0.0,
    }

median_dates = tweets_df.groupby("cluster")["created_at"].median()
median_date_map = {key: value for key, value in median_dates.items() if pd.notna(value)}

reply_df = tweets_df[tweets_df["reply_to_username"].astype(bool)].copy()
reply_map = defaultdict(list)
if not reply_df.empty:
    reply_counts = reply_df.groupby(["cluster", "reply_to_username"]).size().reset_index(name="count")
    for cluster_id, group_df in reply_counts.groupby("cluster"):
        records = group_df.sort_values("count", ascending=False).head(5)
        bucket = []
        for record in records.itertuples():
            username = record.reply_to_username.strip()
            if not username:
                continue
            bucket.append({
                "username": username,
                "count": int(record.count),
            })
        if bucket:
            reply_map[str(cluster_id)] = bucket

related_map = defaultdict(dict)
if os.path.exists(groups_path):
    try:
        with open(groups_path, "r", encoding="utf-8") as handle:
            group_data = json.load(handle)
        for group in group_data.get("groups", []):
            members = []
            for entry in group.get("members", []):
                entry_id = str(entry.get("id") or "")
                if not entry_id:
                    continue
                members.append({
                    "id": entry_id,
                    "name": str(entry.get("name") or name_map.get(entry_id) or entry_id),
                })
            if not members:
                continue
            for member in members:
                others = [other for other in members if other["id"] != member["id"]]
                if not others:
                    continue
                store = related_map[member["id"]]
                for other in others:
                    store[other["id"]] = other["name"]
    except Exception:
        related_map = defaultdict(dict)

clusters = []
for row in hierarchy_df.itertuples():
    cluster_id = row.cluster_id
    stats = stats_map.get(cluster_id, {"tweets_count": 0, "total_likes": 0.0, "median_likes": 0.0})
    median_date = median_date_map.get(cluster_id)
    if median_date is not None:
        median_date_value = median_date.isoformat()
    else:
        median_date_value = None

    total_likes_value = int(round(stats.get("total_likes", 0.0)))
    median_likes_value = stats.get("median_likes", 0.0)
    if math.isnan(median_likes_value):
        median_likes_value = 0.0
    median_likes_int = int(round(median_likes_value))

    related_entries = related_map.get(cluster_id, {})
    related_list = [
        {"id": rel_id, "name": rel_name}
        for rel_id, rel_name in related_entries.items()
        if rel_id in cluster_ids
    ]
    related_list.sort(key=lambda item: item["name"])

    clusters.append({
        "id": cluster_id,
        "name": row.name if isinstance(row.name, str) else cluster_id,
        "summary": row.summary if isinstance(row.summary, str) else "",
        "low_quality": str(row.low_quality_cluster) == "1",
        "tweets_count": stats.get("tweets_count", 0),
        "total_likes": total_likes_value,
        "median_likes": median_likes_int,
        "median_date": median_date_value,
        "tweets_per_month": "placeholder",
        "most_replied_to": reply_map.get(cluster_id, []),
        "related_clusters": related_list,
        "yearly_summaries": yearly_map.get(cluster_id, []),
    })

clusters.sort(
    key=lambda item: (item["median_date"] is not None, item["median_date"]),
    reverse=True,
)

print(json.dumps({"clusters": clusters}))
    `;

    const runScript = () => execPythonJSON(sandbox, script, [mountPath, cleanUsername]);

    const toRecord = (value: unknown) => {
      if (!value || typeof value !== "object") {
        return null;
      }
      return value as Record<string, unknown>;
    };

    let payload = await runScript();
    let record = toRecord(payload);
    let attemptedInstall = false;
    let notFound = false;

    const handleErrorRecord = async () => {
      if (!record) {
        return;
      }
      const errorCode = record.__error__;
      if (typeof errorCode !== "string") {
        return;
      }
      if (errorCode === "not-found") {
        notFound = true;
        record = null;
        return;
      }
      if (errorCode === "missing-dependency" && !attemptedInstall) {
        attemptedInstall = true;
        await installClusterDependencies(sandbox);
        payload = await runScript();
        record = toRecord(payload);
        await handleErrorRecord();
        return;
      }
      throw new Error(
        attemptedInstall
          ? `Cluster retrieval failed after dependency install: ${errorCode}`
          : `Cluster retrieval failed: ${errorCode}`,
      );
    };

    await handleErrorRecord();

    if (!record) {
      return notFound ? null : { clusters: [] };
    }

    const data = record.clusters;
    if (!Array.isArray(data)) {
      return { clusters: [] };
    }

    const sanitizeNumber = (value: unknown): number =>
      typeof value === "number" && Number.isFinite(value) ? value : 0;

    const sanitizeString = (value: unknown): string =>
      typeof value === "string" ? value : "";

    const sanitizeBoolean = (value: unknown): boolean => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value !== 0;
      }
      if (typeof value === "string") {
        return value === "1" || value.toLowerCase() === "true";
      }
      return false;
    };

    const clusters = data.map((entry) => {
      const item = entry as Record<string, unknown>;
      const repliesRaw = Array.isArray(item.most_replied_to) ? item.most_replied_to : [];
      const relatedRaw = Array.isArray(item.related_clusters) ? item.related_clusters : [];
      const yearlyRaw = Array.isArray(item.yearly_summaries) ? item.yearly_summaries : [];

      const yearlySummaries = yearlyRaw
        .map((yearEntry) => {
          const recordYear = yearEntry as Record<string, unknown>;
          const period = sanitizeString(recordYear.period);
          const summaryText = sanitizeString(recordYear.summary);
          if (!period && !summaryText) {
            return null;
          }
          return {
            period: period || "Unknown period",
            summary: summaryText,
          };
        })
        .filter((entry): entry is { period: string; summary: string } => entry !== null);

      return {
        id: sanitizeString(item.id),
        name: sanitizeString(item.name),
        summary: sanitizeString(item.summary),
        lowQuality: sanitizeBoolean(item.low_quality),
        tweetsCount: sanitizeNumber(item.tweets_count),
        medianLikes: sanitizeNumber(item.median_likes),
        totalLikes: sanitizeNumber(item.total_likes),
        medianDate: item.median_date == null ? null : sanitizeString(item.median_date),
        tweetsPerMonthLabel: sanitizeString(item.tweets_per_month) || "placeholder",
        mostRepliedTo: repliesRaw
          .map((reply) => {
            const recordReply = reply as Record<string, unknown>;
            return {
              username: sanitizeString(recordReply.username),
              count: sanitizeNumber(recordReply.count),
            };
          })
          .filter((reply) => reply.username),
        relatedClusters: relatedRaw
          .map((related) => {
            const recordRelated = related as Record<string, unknown>;
            return {
              id: sanitizeString(recordRelated.id),
              name: sanitizeString(recordRelated.name),
            };
          })
          .filter((related) => related.id),
        yearlySummaries,
      };
    });

    return { clusters };
  });
};
