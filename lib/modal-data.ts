import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ModalClient, Sandbox } from "modal";
import type { ClusterOntology, UserClusters } from "@/types/cluster";
import type { ThreadEntry, ThreadTweet, UserThreads } from "@/types/thread";
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

const PYTHON_SCRIPT_DIR = join(process.cwd(), "lib", "python");
const pythonScriptCache = new Map<string, string>();

const loadPythonScript = (filename: string) => {
  const cached = pythonScriptCache.get(filename);
  if (cached) {
    return cached;
  }
  const script = readFileSync(join(PYTHON_SCRIPT_DIR, filename), "utf8");
  pythonScriptCache.set(filename, script);
  return script;
};

type PythonRecordResult =
  | { ok: true; record: Record<string, unknown> }
  | { ok: false; errorCode: string | null };

const toPythonRecordResult = (value: unknown): PythonRecordResult => {
  if (!value || typeof value !== "object") {
    return { ok: false, errorCode: null };
  }
  const record = value as Record<string, unknown>;
  const errorValue = record["__error__"];
  if (typeof errorValue === "string") {
    return { ok: false, errorCode: errorValue };
  }
  return { ok: true, record };
};

const sandboxInstallPromises = new WeakMap<Sandbox, Promise<void>>();
const sandboxInstallFailures = new WeakMap<Sandbox, Error>();
const sandboxInstallSuccess = new WeakSet<Sandbox>();

const ensureClusterDependencies = async (sandbox: Sandbox) => {
  if (sandboxInstallSuccess.has(sandbox)) {
    return;
  }

  const failure = sandboxInstallFailures.get(sandbox);
  if (failure) {
    throw failure;
  }

  const existingPromise = sandboxInstallPromises.get(sandbox);
  if (existingPromise) {
    return existingPromise;
  }

  const installPromise = (async () => {
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
  })();

  sandboxInstallPromises.set(sandbox, installPromise);

  try {
    await installPromise;
    sandboxInstallSuccess.add(sandbox);
    sandboxInstallFailures.delete(sandbox);
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    sandboxInstallFailures.set(sandbox, normalizedError);
    throw normalizedError;
  } finally {
    sandboxInstallPromises.delete(sandbox);
  }
};

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
    const script = loadPythonScript("list_volume_users.py");

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
    const script = loadPythonScript("get_user_summary.py");

    const payload = await execPythonJSON(sandbox, script, [mountPath, cleanUsername]);
    const result = toPythonRecordResult(payload);
    if (!result.ok) {
      return null;
    }
    const record = result.record;

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
    const script = loadPythonScript("get_user_clusters.py");

    const runScript = async () => {
      const payload = await execPythonJSON(sandbox, script, [mountPath, cleanUsername]);
      return toPythonRecordResult(payload);
    };

    let result = await runScript();
    let attemptedInstall = false;
    let notFound = false;

    const resolveRecord = async (): Promise<Record<string, unknown> | null> => {
      while (!result.ok) {
        const errorCode = result.errorCode;
        if (errorCode === "not-found") {
          notFound = true;
          return null;
        }
        if (errorCode === "missing-dependency" && !attemptedInstall) {
          attemptedInstall = true;
          await ensureClusterDependencies(sandbox);
          result = await runScript();
          continue;
        }
        if (!errorCode) {
          return null;
        }
        throw new Error(
          attemptedInstall
            ? `Cluster retrieval failed after dependency install: ${errorCode}`
            : `Cluster retrieval failed: ${errorCode}`,
        );
      }
      return result.record;
    };

    const record = await resolveRecord();

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

    const sanitizeStringArray = (value: unknown): string[] => {
      if (!Array.isArray(value)) {
        return [];
      }
      const bucket: string[] = [];
      for (const entry of value) {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          if (trimmed) {
            bucket.push(trimmed);
          }
        } else if (typeof entry === "number" && Number.isFinite(entry)) {
          bucket.push(String(entry));
        }
      }
      return bucket;
    };

    const createEmptyOntology = (): ClusterOntology => ({
      entities: [],
      beliefsAndValues: [],
      goals: [],
      socialRelationships: [],
      moodsAndEmotionalTones: [],
      keyConcepts: [],
    });

    const mapOntologyList = <T>(
      value: unknown,
      mapper: (record: Record<string, unknown>) => T | null,
    ): T[] => {
      if (!Array.isArray(value)) {
        return [];
      }
      const results: T[] = [];
      for (const entry of value) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const mapped = mapper(entry as Record<string, unknown>);
        if (mapped) {
          results.push(mapped);
        }
      }
      return results;
    };

    const sanitizeOntology = (value: unknown): ClusterOntology => {
      if (!value || typeof value !== "object") {
        return createEmptyOntology();
      }
      const source = value as Record<string, unknown>;
      return {
        entities: mapOntologyList(source["entities"], (record) => {
          const name = sanitizeString(record["name"]);
          const description = sanitizeString(record["description"]);
          if (!name && !description) {
            return null;
          }
          return {
            id: sanitizeString(record["id"]),
            name,
            description,
            tweetReferences: sanitizeStringArray(record["tweet_references"]),
          };
        }),
        beliefsAndValues: mapOntologyList(source["beliefs_and_values"], (record) => {
          const belief = sanitizeString(record["belief"]);
          const description = sanitizeString(record["description"]);
          if (!belief && !description) {
            return null;
          }
          return {
            id: sanitizeString(record["id"]),
            belief,
            description,
            tweetReferences: sanitizeStringArray(record["tweet_references"]),
          };
        }),
        goals: mapOntologyList(source["goals"], (record) => {
          const goal = sanitizeString(record["goal"]);
          const description = sanitizeString(record["description"]);
          if (!goal && !description) {
            return null;
          }
          return {
            id: sanitizeString(record["id"]),
            goal,
            description,
            tweetReferences: sanitizeStringArray(record["tweet_references"]),
          };
        }),
        socialRelationships: mapOntologyList(source["social_relationships"], (record) => {
          const username = sanitizeString(record["username"]);
          const interactionType = sanitizeString(record["interaction_type"]);
          if (!username && !interactionType) {
            return null;
          }
          return {
            id: sanitizeString(record["id"]),
            username,
            interactionType,
            tweetReferences: sanitizeStringArray(record["tweet_references"]),
          };
        }),
        moodsAndEmotionalTones: mapOntologyList(source["moods_and_emotional_tones"], (record) => {
          const mood = sanitizeString(record["mood"]);
          const description = sanitizeString(record["description"]);
          if (!mood && !description) {
            return null;
          }
          return {
            id: sanitizeString(record["id"]),
            mood,
            description,
            tweetReferences: sanitizeStringArray(record["tweet_references"]),
          };
        }),
        keyConcepts: mapOntologyList(source["key_concepts_and_ideas"], (record) => {
          const concept = sanitizeString(record["concept"]);
          const description = sanitizeString(record["description"]);
          if (!concept && !description) {
            return null;
          }
          return {
            id: sanitizeString(record["id"]),
            concept,
            description,
            tweetReferences: sanitizeStringArray(record["tweet_references"]),
          };
        }),
      };
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
        ontology: sanitizeOntology(item.ontology),
      };
    });

    return { clusters };
  });
};

export const getUserThreads = async (username: string): Promise<UserThreads | null> => {
  const cleanUsername = username.replace(/^@/, "").trim();
  if (!cleanUsername) {
    return null;
  }

  return runInSandbox(async (sandbox, mountPath) => {
    const script = loadPythonScript("get_user_threads.py");

    const runScript = async () => {
      const payload = await execPythonJSON(sandbox, script, [mountPath, cleanUsername]);
      return toPythonRecordResult(payload);
    };

    let result = await runScript();
    let attemptedInstall = false;
    let notFound = false;

    const resolveRecord = async (): Promise<Record<string, unknown> | null> => {
      while (!result.ok) {
        const errorCode = result.errorCode;
        if (errorCode === "not-found") {
          notFound = true;
          return null;
        }
        if (errorCode === "missing-dependency" && !attemptedInstall) {
          attemptedInstall = true;
          await ensureClusterDependencies(sandbox);
          result = await runScript();
          continue;
        }
        if (!errorCode) {
          return null;
        }
        throw new Error(
          attemptedInstall
            ? `Thread retrieval failed after dependency install: ${errorCode}`
            : `Thread retrieval failed: ${errorCode}`,
        );
      }
      return result.record;
    };

    const record = await resolveRecord();
    if (!record) {
      return notFound ? null : { threads: [] };
    }

    const data = record.threads;
    if (!Array.isArray(data)) {
      return { threads: [] };
    }

    const sanitizeString = (value: unknown): string => {
      if (typeof value === "string") {
        return value.trim();
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
      return "";
    };

    const sanitizeBoolean = (value: unknown): boolean => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value !== 0;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "1" || normalized === "true";
      }
      return false;
    };

    const sanitizeNumber = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string") {
        const parsed = Number(value.replace(/,/g, ""));
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return 0;
    };

    const sanitizeDate = (value: unknown): string | null => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed || null;
      }
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString();
      }
      return null;
    };

    const sanitizeTweet = (value: unknown): ThreadTweet | null => {
      if (!value || typeof value !== "object") {
        return null;
      }
      const record = value as Record<string, unknown>;
      const id = sanitizeString(record.id);
      if (!id) {
        return null;
      }

      return {
        id,
        username: sanitizeString(record.username),
        createdAt: sanitizeDate(record.created_at ?? record.createdAt),
        fullText: sanitizeString(record.full_text ?? record.fullText),
        favoriteCount: sanitizeNumber(record.favorite_count ?? record.favoriteCount),
        clusterId: sanitizeString(record.cluster_id ?? record.clusterId),
        clusterProb: sanitizeNumber(record.cluster_prob ?? record.clusterProb),
        isReply: sanitizeBoolean(record.is_reply ?? record.isReply),
        isRetweet: sanitizeBoolean(record.is_retweet ?? record.isRetweet),
      };
    };

    const threads: ThreadEntry[] = [];
    for (const entry of data) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const id = sanitizeString(record.id);
      if (!id) {
        continue;
      }
      const tweetsRaw = Array.isArray(record.tweets) ? record.tweets : [];
      const tweets: ThreadTweet[] = [];
      for (const rawTweet of tweetsRaw) {
        const tweet = sanitizeTweet(rawTweet);
        if (tweet) {
          tweets.push(tweet);
        }
      }

      threads.push({
        id,
        clusterId: sanitizeString(record.cluster_id ?? record.clusterId),
        isIncomplete: sanitizeBoolean(record.is_incomplete ?? record.isIncomplete),
        rootIsReply: sanitizeBoolean(record.root_is_reply ?? record.rootIsReply),
        containsRetweet: sanitizeBoolean(record.contains_retweet ?? record.containsRetweet),
        totalFavorites: sanitizeNumber(record.total_favorites ?? record.totalFavorites),
        rootCreatedAt: sanitizeDate(record.root_created_at ?? record.rootCreatedAt),
        maxClusterProb: sanitizeNumber(record.max_cluster_prob ?? record.maxClusterProb),
        tweets,
      });
    }

    return { threads };
  });
};
