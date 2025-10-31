import { ModalClient, Sandbox } from "modal";
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
