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
