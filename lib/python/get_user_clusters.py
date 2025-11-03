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

def to_string(value):
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if math.isnan(value):
            return ""
        if value.is_integer():
            return str(int(value))
        return str(value)
    return ""

def normalize_references(raw):
    bucket = []
    if isinstance(raw, (list, tuple)):
        for item in raw:
            text = to_string(item)
            if text:
                bucket.append(text)
    return bucket

def normalize_entities(items):
    bucket = []
    if isinstance(items, list):
        for entry in items:
            if not isinstance(entry, dict):
                continue
            label = to_string(entry.get("name"))
            description = to_string(entry.get("description"))
            if not label and not description:
                continue
            bucket.append({
                "id": to_string(entry.get("id")),
                "name": label,
                "description": description,
                "tweet_references": normalize_references(entry.get("tweet_references")),
            })
            if len(bucket) >= 4:
                break
    return bucket

def normalize_beliefs(items):
    bucket = []
    if isinstance(items, list):
        for entry in items:
            if not isinstance(entry, dict):
                continue
            belief = to_string(entry.get("belief"))
            description = to_string(entry.get("description"))
            if not belief and not description:
                continue
            bucket.append({
                "id": to_string(entry.get("id")),
                "belief": belief,
                "description": description,
                "tweet_references": normalize_references(entry.get("tweet_references")),
            })
            if len(bucket) >= 4:
                break
    return bucket

def normalize_goals(items):
    bucket = []
    if isinstance(items, list):
        for entry in items:
            if not isinstance(entry, dict):
                continue
            goal = to_string(entry.get("goal"))
            description = to_string(entry.get("description"))
            if not goal and not description:
                continue
            bucket.append({
                "id": to_string(entry.get("id")),
                "goal": goal,
                "description": description,
                "tweet_references": normalize_references(entry.get("tweet_references")),
            })
            if len(bucket) >= 4:
                break
    return bucket

def normalize_relationships(items):
    bucket = []
    if isinstance(items, list):
        for entry in items:
            if not isinstance(entry, dict):
                continue
            username = to_string(entry.get("username"))
            interaction_type = to_string(entry.get("interaction_type"))
            if not username and not interaction_type:
                continue
            bucket.append({
                "id": to_string(entry.get("id")),
                "username": username,
                "interaction_type": interaction_type,
                "tweet_references": normalize_references(entry.get("tweet_references")),
            })
            if len(bucket) >= 4:
                break
    return bucket

def normalize_moods(items):
    bucket = []
    if isinstance(items, list):
        for entry in items:
            if not isinstance(entry, dict):
                continue
            mood = to_string(entry.get("mood"))
            description = to_string(entry.get("description"))
            if not mood and not description:
                continue
            bucket.append({
                "id": to_string(entry.get("id")),
                "mood": mood,
                "description": description,
                "tweet_references": normalize_references(entry.get("tweet_references")),
            })
            if len(bucket) >= 4:
                break
    return bucket

def normalize_concepts(items):
    bucket = []
    if isinstance(items, list):
        for entry in items:
            if not isinstance(entry, dict):
                continue
            concept = to_string(entry.get("concept"))
            description = to_string(entry.get("description"))
            if not concept and not description:
                continue
            bucket.append({
                "id": to_string(entry.get("id")),
                "concept": concept,
                "description": description,
                "tweet_references": normalize_references(entry.get("tweet_references")),
            })
            if len(bucket) >= 4:
                break
    return bucket

def empty_ontology():
    return {
        "entities": [],
        "beliefs_and_values": [],
        "goals": [],
        "social_relationships": [],
        "moods_and_emotional_tones": [],
        "key_concepts_and_ideas": [],
    }

def extract_ontology(entry):
    if not isinstance(entry, dict):
        entry = {}
    container = entry.get("ontology_items")
    if not isinstance(container, dict):
        container = entry
    data = empty_ontology()
    data["entities"] = normalize_entities(container.get("entities"))
    data["beliefs_and_values"] = normalize_beliefs(container.get("beliefs_and_values"))
    data["goals"] = normalize_goals(container.get("goals"))
    data["social_relationships"] = normalize_relationships(container.get("social_relationships"))
    data["moods_and_emotional_tones"] = normalize_moods(container.get("moods_and_emotional_tones"))
    data["key_concepts_and_ideas"] = normalize_concepts(container.get("key_concepts_and_ideas"))
    return data

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
ontology_map = {}

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
                ontology_map[cluster_key_str] = extract_ontology(entry)
    except Exception:
        yearly_map = {}
        ontology_map = {}

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
                if cluster_key_str not in ontology_map:
                    ontology_map[cluster_key_str] = extract_ontology(entry)
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
            "ontology": ontology_map.get(row.cluster_id, empty_ontology()),
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
        "ontology": ontology_map.get(cluster_id, empty_ontology()),
    })

clusters.sort(
    key=lambda item: (item["median_date"] is not None, item["median_date"]),
    reverse=True,
)

print(json.dumps({"clusters": clusters}))
