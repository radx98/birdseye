import json
import math
import os
import pickle
import sys
from typing import Dict, Iterable, List, Optional, Sequence


def to_string(value) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return ""
        text = str(value)
        return text.strip()
    return ""


def to_int(value) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return 0
        return int(value)
    if isinstance(value, str):
        try:
            return int(float(value.strip()))
        except Exception:
            return 0
    return 0


def to_float(value) -> float:
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isnan(value):
            return 0.0
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except Exception:
            return 0.0
    return 0.0


def detect_retweet(text: str) -> bool:
    snippet = (text or "").lstrip()
    if not snippet:
        return False
    return snippet.lower().startswith("rt @")


def pick_longest_path(
    paths: Optional[Dict[str, Sequence]],
    root_id: str,
    children: Dict[str, List[str]],
) -> List[str]:
    best_path: List[str] = []

    if isinstance(paths, dict) and paths:
        for path in paths.values():
            if not isinstance(path, (list, tuple)):
                continue
            normalized = []
            for entry in path:
                text = to_string(entry)
                if text:
                    normalized.append(text)
            if not normalized:
                continue
            if normalized[0] != root_id:
                normalized.insert(0, root_id)
            if len(normalized) > len(best_path):
                best_path = normalized
        if best_path:
            return best_path

    stack: List[List[str]] = [[root_id]]
    while stack:
        current_path = stack.pop()
        current_node = current_path[-1]
        next_children = children.get(current_node, [])
        if not next_children:
            if len(current_path) > len(best_path):
                best_path = current_path
            continue
        for child in next_children:
            child_id = to_string(child)
            if not child_id:
                continue
            stack.append(current_path + [child_id])

    return best_path


def normalize_created_at(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text if text else None
    try:
        import pandas as pd  # type: ignore

        if isinstance(value, pd.Timestamp):
            if pd.isna(value):
                return None
            return value.isoformat()
    except Exception:
        pass
    return to_string(value) or None


def load_pickle(path: str):
    try:
        with open(path, "rb") as handle:
            return pickle.load(handle)
    except Exception:
        return {}


try:
    import pandas as pd  # type: ignore
except Exception:
    print(json.dumps({"__error__": "missing-dependency"}))
    sys.exit(0)


root = sys.argv[1]
user = sys.argv[2]
user_path = os.path.join(root, user)

if not os.path.isdir(user_path):
    print(json.dumps({"__error__": "not-found"}))
    sys.exit(0)

tweets_path = os.path.join(user_path, "clustered_tweets_df.parquet")
trees_path = os.path.join(user_path, "trees.pkl")
incomplete_path = os.path.join(user_path, "incomplete_trees.pkl")

if not os.path.exists(tweets_path):
    print(json.dumps({"threads": []}))
    sys.exit(0)

columns = [
    "tweet_id",
    "cluster",
    "cluster_prob",
    "username",
    "created_at",
    "full_text",
    "favorite_count",
    "reply_to_tweet_id",
]

try:
    tweets_df = pd.read_parquet(tweets_path, columns=columns)
except Exception:
    print(json.dumps({"__error__": "tweets-read"}))
    sys.exit(0)

if tweets_df.empty:
    print(json.dumps({"threads": []}))
    sys.exit(0)

tweets_df["tweet_id"] = tweets_df["tweet_id"].astype(str)
tweets_df["cluster"] = tweets_df["cluster"].astype(str)
tweets_df = tweets_df.dropna(subset=["tweet_id"])

tweet_lookup = {}
for record in tweets_df.to_dict("records"):
    tweet_id = to_string(record.get("tweet_id"))
    if not tweet_id:
        continue
    tweet_lookup[tweet_id] = {
        "cluster": to_string(record.get("cluster")),
        "cluster_prob": to_float(record.get("cluster_prob")),
        "username": to_string(record.get("username")),
        "created_at": normalize_created_at(record.get("created_at")),
        "full_text": to_string(record.get("full_text")),
        "favorite_count": to_int(record.get("favorite_count")),
        "reply_to_tweet_id": to_string(record.get("reply_to_tweet_id")),
    }

trees_data = {}
if os.path.exists(trees_path):
    payload = load_pickle(trees_path)
    if isinstance(payload, dict):
        trees_data = payload

incomplete_data = {}
if os.path.exists(incomplete_path):
    payload = load_pickle(incomplete_path)
    if isinstance(payload, dict):
        incomplete_data = payload

combined_roots = {}
for source_map, is_incomplete in ((trees_data, False), (incomplete_data, True)):
    if not isinstance(source_map, dict):
        continue
    for key, tree in source_map.items():
        root_id = to_string(key)
        if not root_id:
            continue
        if root_id in combined_roots:
            continue
        combined_roots[root_id] = (tree, is_incomplete)

threads = []

for root_id, (tree, is_incomplete) in combined_roots.items():
    if not isinstance(tree, dict):
        continue

    tweets = tree.get("tweets")
    if not isinstance(tweets, dict):
        tweets = {}

    children_map_raw = tree.get("children")
    children_map = {}
    if isinstance(children_map_raw, dict):
        for parent, child_list in children_map_raw.items():
            parent_id = to_string(parent)
            if not parent_id:
                continue
            bucket = []
            if isinstance(child_list, (list, tuple)):
                for child in child_list:
                    child_id = to_string(child)
                    if child_id:
                        bucket.append(child_id)
            if bucket:
                children_map[parent_id] = bucket

    paths = tree.get("paths")
    normalized_paths = {}
    if isinstance(paths, dict):
        for leaf, path in paths.items():
            if not isinstance(path, (list, tuple)):
                continue
            normalized = []
            for entry in path:
                text = to_string(entry)
                if text:
                    normalized.append(text)
            if normalized:
                normalized_paths[to_string(leaf)] = normalized

    longest_path = pick_longest_path(normalized_paths, root_id, children_map)
    if not longest_path:
        longest_path = [root_id]

    tweet_entries = []
    total_favorites = 0
    max_cluster_prob = 0.0
    cluster_candidate = ""
    root_is_reply = False
    contains_retweet = False
    root_created_at = None

    for index, tweet_id in enumerate(longest_path):
        tweet_info = tweet_lookup.get(tweet_id, {})
        tree_info = tweets.get(tweet_id, {}) if isinstance(tweets.get(tweet_id), dict) else {}

        username = tweet_info.get("username") or to_string(tree_info.get("username"))
        created_at = tweet_info.get("created_at") or normalize_created_at(tree_info.get("created_at"))
        full_text = tweet_info.get("full_text") or to_string(tree_info.get("full_text"))
        favorite_count = tweet_info.get("favorite_count")
        if favorite_count is None:
            favorite_count = to_int(tree_info.get("favorite_count"))
        reply_to = tweet_info.get("reply_to_tweet_id") or to_string(tree_info.get("reply_to_tweet_id"))
        cluster_id = tweet_info.get("cluster") or to_string(tree_info.get("cluster"))
        cluster_prob = tweet_info.get("cluster_prob")
        if cluster_prob is None:
            cluster_prob = to_float(tree_info.get("cluster_prob"))

        is_reply = bool(reply_to)
        is_retweet = detect_retweet(full_text)

        if index == 0:
            root_is_reply = is_reply
            root_created_at = created_at

        if cluster_id and not cluster_candidate:
            cluster_candidate = cluster_id

        total_favorites += to_int(favorite_count)
        if cluster_prob and cluster_prob > max_cluster_prob:
            max_cluster_prob = cluster_prob
        if is_retweet:
            contains_retweet = True

        tweet_entries.append(
            {
                "id": tweet_id,
                "username": username,
                "created_at": created_at,
                "full_text": full_text,
                "favorite_count": to_int(favorite_count),
                "cluster_id": cluster_id,
                "cluster_prob": cluster_prob,
                "is_reply": is_reply,
                "is_retweet": is_retweet,
            }
        )

    if not tweet_entries:
        continue

    threads.append(
        {
            "id": root_id,
            "cluster_id": cluster_candidate,
            "is_incomplete": bool(is_incomplete),
            "root_is_reply": bool(root_is_reply),
            "contains_retweet": bool(contains_retweet),
            "total_favorites": total_favorites,
            "root_created_at": root_created_at,
            "max_cluster_prob": max_cluster_prob,
            "tweets": tweet_entries,
        }
    )

if not threads:
    print(json.dumps({"threads": []}))
    sys.exit(0)

threads.sort(
    key=lambda item: (
        item.get("root_created_at") is not None,
        item.get("root_created_at") or "",
    ),
    reverse=True,
)

print(json.dumps({"threads": threads}))
