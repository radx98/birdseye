import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { GetObjectCommand, ListBucketsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { BufferReader, Parser as PickleParser } from "pickleparser";
import { fetchAvatarsByAccountId } from "@/lib/supabase-client";
import type { ClusterOntology, UserClusters } from "@/types/cluster";
import type { ThreadEntry, ThreadTweet, UserThreads } from "@/types/thread";
import type { UserSummary } from "@/types/user";

const ACCESS_KEY_ID = process.env.aws_access_key_id ?? process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY =
  process.env.aws_secret_access_key ?? process.env.AWS_SECRET_ACCESS_KEY;
const ENDPOINT_URL = process.env.endpoint_url ?? process.env.AWS_ENDPOINT_URL;
const REGION = process.env.region ?? process.env.AWS_REGION ?? "us-east-1";
const BUCKET =
  process.env.supabase_bucket ??
  process.env.supabase_s3_bucket ??
  process.env.AWS_BUCKET ??
  process.env.S3_BUCKET;

if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !ENDPOINT_URL) {
  throw new Error(
    "Missing Supabase S3 configuration. Ensure aws_access_key_id, aws_secret_access_key, and endpoint_url are set.",
  );
}

const s3Client = new S3Client({
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
  endpoint: ENDPOINT_URL,
  forcePathStyle: true,
  region: REGION,
});

const objectCache = new Map<string, Promise<Buffer | null>>();

let resolvedBucketPromise: Promise<string> | null = BUCKET ? Promise.resolve(BUCKET) : null;

type ParquetModule = typeof import("parquet-wasm/bundler");
type ArrowModule = typeof import("apache-arrow");

let parquetEnvironmentPromise: Promise<{ parquet: ParquetModule; arrow: ArrowModule }> | null =
  null;

const AVATAR_PLACEHOLDER = "/placeholder.jpg";

const loadParquetEnvironment = async () => {
  if (!parquetEnvironmentPromise) {
    parquetEnvironmentPromise = Promise.all([
      import("parquet-wasm/bundler") as Promise<ParquetModule>,
      import("apache-arrow") as Promise<ArrowModule>,
    ]).then(([parquet, arrow]) => ({ parquet, arrow }));
  }
  return parquetEnvironmentPromise;
};

type MutableBufferReader = BufferReader & {
  _dataView: DataView;
  _position: number;
  skip: (offset: number) => void;
};

let pickleReaderPatched = false;

const ensurePatchedPickleReader = () => {
  if (pickleReaderPatched) {
    return;
  }
  const prototype = BufferReader.prototype as MutableBufferReader;
  // Replace the uint64 reader to avoid precision-loss warnings and return BigInt when needed.
  (prototype as MutableBufferReader).uint64 = function uint64Patched(this: MutableBufferReader) {
    const position = this._position;
    this.skip(8);
    const view = this._dataView;
    const lower = BigInt(view.getUint32(position, true));
    const upper = BigInt(view.getUint32(position + 4, true));
    const combined = (upper << BigInt(32)) + lower;
    if (combined <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(combined);
    }
    return combined;
  } as MutableBufferReader["uint64"];

  pickleReaderPatched = true;
};

const getBucketName = async (): Promise<string> => {
  if (resolvedBucketPromise) {
    return resolvedBucketPromise;
  }

  resolvedBucketPromise = (async () => {
    try {
      const response = await s3Client.send(new ListBucketsCommand({}));
      const buckets = response.Buckets ?? [];
      const candidate = buckets.find((bucket) => bucket.Name && bucket.Name.trim());
      if (!candidate || !candidate.Name) {
        throw new Error("Supabase bucket not found via ListBuckets.");
      }
      return candidate.Name;
    } catch (error) {
      resolvedBucketPromise = null;
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to resolve Supabase bucket name automatically. Set supabase_bucket (or equivalent) in the environment. (Reason: ${reason})`,
      );
    }
  })();

  return resolvedBucketPromise;
};

const normalizeUsername = (username: string) => username.replace(/^@/, "").trim().toLowerCase();

const streamToBuffer = async (body: unknown): Promise<Buffer> => {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === "string") {
    return Buffer.from(body);
  }
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(Buffer.from(chunk));
      }
    }
    return Buffer.concat(chunks);
  }
  const transformer = body as { transformToByteArray?: () => Promise<Uint8Array>; arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof transformer.transformToByteArray === "function") {
    const array = await transformer.transformToByteArray();
    return Buffer.from(array);
  }
  if (typeof transformer.arrayBuffer === "function") {
    const arrayBuffer = await transformer.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  throw new Error("Unsupported S3 response body type.");
};

const isNotFoundError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  if (candidate.$metadata?.httpStatusCode === 404) {
    return true;
  }
  const code = candidate.Code ?? candidate.name;
  return code === "NotFound" || code === "NoSuchKey";
};

const fetchObjectBuffer = async (key: string): Promise<Buffer | null> => {
  const bucket = await getBucketName();
  const cacheKey = `${bucket}:${key}`;
  const cached = objectCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    try {
      const result = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      if (!result.Body) {
        return null;
      }
      return streamToBuffer(result.Body);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  })();

  objectCache.set(cacheKey, promise);
  try {
    const buffer = await promise;
    if (buffer === null) {
      objectCache.delete(cacheKey);
    }
    return buffer;
  } catch (error) {
    objectCache.delete(cacheKey);
    throw error;
  }
};

const readJsonFile = async <T>(username: string, filename: string): Promise<T | null> => {
  const key = `${username}/${filename}`;
  const buffer = await fetchObjectBuffer(key);
  if (!buffer) {
    return null;
  }
  try {
    return JSON.parse(buffer.toString("utf8")) as T;
  } catch (error) {
    console.warn(`[storage][json][${key}]`, error);
    return null;
  }
};

const normalizeArrowValue = (value: unknown): unknown => {
  if (value == null) {
    return null;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    if (typeof (view as { length?: number }).length === "number") {
      return Array.from(view as unknown as ArrayLike<number>);
    }
    return Array.from(new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)));
  }
  return value;
};

const readParquetRecords = async (
  username: string,
  filename: string,
  columns?: string[],
): Promise<Record<string, unknown>[]> => {
  const key = `${username}/${filename}`;
  const buffer = await fetchObjectBuffer(key);
  if (!buffer) {
    return [];
  }

  const { parquet, arrow } = await loadParquetEnvironment();

  let table;
  try {
    table = parquet.readParquet(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read Parquet file "${key}": ${message}`);
  }

  const ipcStream = table.intoIPCStream();
  const arrowTable = arrow.tableFromIPC(ipcStream);

  const targetFields =
    columns && columns.length > 0
      ? columns
      : arrowTable.schema.fields.map((field) => field.name);

  const rows: Record<string, unknown>[] = [];

  for (const row of arrowTable as Iterable<Record<string, unknown>>) {
    const record: Record<string, unknown> = {};
    for (const fieldName of targetFields) {
      record[fieldName] = normalizeArrowValue(row[fieldName]);
    }
    rows.push(record);
  }

  return rows;
};

const convertPickleValue = (value: unknown, seen: WeakMap<object, unknown>): unknown => {
  if (!value) {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (value instanceof Map) {
    const target: Record<string, unknown> = {};
    seen.set(value, target);
    for (const [rawKey, rawVal] of value.entries()) {
      const key = typeof rawKey === "string" ? rawKey : String(rawKey);
      target[key] = convertPickleValue(rawVal, seen);
    }
    return target;
  }

  if (Array.isArray(value)) {
    const list: unknown[] = [];
    seen.set(value, list);
    for (const entry of value) {
      list.push(convertPickleValue(entry, seen));
    }
    return list;
  }

  const source = value as Record<string, unknown>;
  const copy: Record<string, unknown> = {};
  seen.set(value, copy);
  for (const [key, rawVal] of Object.entries(source)) {
    copy[key] = convertPickleValue(rawVal, seen);
  }
  return copy;
};

const readPickleFile = async (username: string, filename: string): Promise<unknown> => {
  const key = `${username}/${filename}`;
  const buffer = await fetchObjectBuffer(key);
  if (!buffer) {
    return null;
  }
  ensurePatchedPickleReader();
  try {
    const parser = new PickleParser();
    const parsed = parser.parse(buffer);
    return convertPickleValue(parsed, new WeakMap());
  } catch (error) {
    console.warn(`[storage][pickle][${key}]`, error);
    return null;
  }
};

const sanitizeString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return "";
};

const sanitizeNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    if (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) {
      return Number(value);
    }
    return Number.MAX_SAFE_INTEGER;
  }
  if (typeof value === "string") {
    const numeric = Number(value.replace(/,/g, ""));
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return 0;
};

type NormalizedTweetRow = {
  tweetId: string;
  accountId: string;
  clusterId: string;
  clusterProb: number;
  favoriteCount: number;
  replyToUserId: string;
  replyToUsername: string;
  replyToTweetId: string;
  username: string;
  fullText: string;
  createdAt: string | null;
  createdAtMs: number | null;
};

const TWEET_ROW_COLUMNS = [
  "tweet_id",
  "account_id",
  "cluster",
  "cluster_prob",
  "favorite_count",
  "reply_to_user_id",
  "reply_to_username",
  "reply_to_tweet_id",
  "username",
  "created_at",
  "full_text",
];

const tweetRowsCache = new Map<string, Promise<NormalizedTweetRow[]>>();

const loadTweetRows = async (username: string): Promise<NormalizedTweetRow[]> => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) {
    return [];
  }

  const cached = tweetRowsCache.get(normalizedUsername);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const rows = await readParquetRecords(normalizedUsername, "clustered_tweets_df.parquet", TWEET_ROW_COLUMNS);
    if (!rows.length) {
      return [] as NormalizedTweetRow[];
    }

    const normalizedRows: NormalizedTweetRow[] = [];

    for (const row of rows) {
      const tweetId = sanitizeString(row["tweet_id"]);
      const accountId = sanitizeString(row["account_id"]);
      const clusterId = sanitizeString(row["cluster"]);
      const clusterProb = sanitizeNumber(row["cluster_prob"]);
      const favoriteCount = Math.round(sanitizeNumber(row["favorite_count"]));
      const replyToUserId = sanitizeString(row["reply_to_user_id"]);
      const replyToUsername = sanitizeString(row["reply_to_username"]);
      const replyToTweetId = sanitizeString(row["reply_to_tweet_id"]);
      const usernameValue = sanitizeString(row["username"]);
      const fullText = sanitizeString(row["full_text"]);

      const rawCreatedAt = row["created_at"];
      let createdAt: string | null = null;
      let createdAtMs: number | null = null;

      if (rawCreatedAt instanceof Date && !Number.isNaN(rawCreatedAt.getTime())) {
        createdAtMs = rawCreatedAt.getTime();
        createdAt = rawCreatedAt.toISOString();
      } else {
        const createdAtText = sanitizeString(rawCreatedAt);
        if (createdAtText) {
          const parsed = Date.parse(createdAtText);
          if (Number.isFinite(parsed)) {
            createdAtMs = parsed;
            createdAt = new Date(parsed).toISOString();
          } else {
            createdAt = createdAtText;
          }
        }
      }

      normalizedRows.push({
        tweetId,
        accountId,
        clusterId,
        clusterProb,
        favoriteCount,
        replyToUserId,
        replyToUsername,
        replyToTweetId,
        username: usernameValue,
        fullText,
        createdAt,
        createdAtMs,
      });
    }

    return normalizedRows;
  })();

  tweetRowsCache.set(normalizedUsername, promise);

  try {
    const result = await promise;
    if (!result.length) {
      tweetRowsCache.delete(normalizedUsername);
    }
    return result;
  } catch (error) {
    tweetRowsCache.delete(normalizedUsername);
    throw error;
  }
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

const sanitizeStringArray = (value: unknown, limit = 0): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const results: string[] = [];
  for (const entry of value) {
    const text = sanitizeString(entry);
    if (!text) {
      continue;
    }
    results.push(text);
    if (limit > 0 && results.length >= limit) {
      break;
    }
  }
  return results;
};

const toUtcMonthIso = (year: number, monthIndex: number): string => {
  const date = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  return date.toISOString();
};

const buildMonthlyTweetSeries = (timestamps: number[]): { month: string; count: number }[] => {
  if (!timestamps.length) {
    return [];
  }

  let minYear = Number.POSITIVE_INFINITY;
  let minMonth = Number.POSITIVE_INFINITY;
  let maxYear = Number.NEGATIVE_INFINITY;
  let maxMonth = Number.NEGATIVE_INFINITY;

  const counts = new Map<string, number>();

  for (const rawTimestamp of timestamps) {
    if (!Number.isFinite(rawTimestamp)) {
      continue;
    }
    const value = Math.trunc(rawTimestamp);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const year = date.getUTCFullYear();
    const monthIndex = date.getUTCMonth();
    if (year < minYear || (year === minYear && monthIndex < minMonth)) {
      minYear = year;
      minMonth = monthIndex;
    }
    if (year > maxYear || (year === maxYear && monthIndex > maxMonth)) {
      maxYear = year;
      maxMonth = monthIndex;
    }
    const key = `${year}-${monthIndex}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (
    !counts.size ||
    !Number.isFinite(minYear) ||
    !Number.isFinite(minMonth) ||
    !Number.isFinite(maxYear) ||
    !Number.isFinite(maxMonth)
  ) {
    return [];
  }

  const series: { month: string; count: number }[] = [];

  let cursorYear = minYear;
  let cursorMonth = minMonth;
  while (cursorYear < maxYear || (cursorYear === maxYear && cursorMonth <= maxMonth)) {
    const key = `${cursorYear}-${cursorMonth}`;
    const isoMonth = toUtcMonthIso(cursorYear, cursorMonth);
    series.push({
      month: isoMonth,
      count: counts.get(key) ?? 0,
    });
    cursorMonth += 1;
    if (cursorMonth >= 12) {
      cursorMonth = 0;
      cursorYear += 1;
    }
  }

  return series;
};

const medianNumber = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const medianDateIso = (timestamps: number[]): string | null => {
  if (!timestamps.length) {
    return null;
  }
  const sorted = [...timestamps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted[mid];
  if (!Number.isFinite(median)) {
    return null;
  }
  return new Date(median).toISOString();
};

const normalizeOntology = (value: unknown): ClusterOntology => {
  const fallback: ClusterOntology = {
    entities: [],
    beliefsAndValues: [],
    goals: [],
    socialRelationships: [],
    moodsAndEmotionalTones: [],
    keyConcepts: [],
  };
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const source = value as Record<string, unknown>;

  const slice = <T>(
    raw: unknown,
    mapper: (entry: Record<string, unknown>) => T | null,
  ): T[] => {
    if (!Array.isArray(raw)) {
      return [];
    }
    const bucket: T[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const mapped = mapper(entry as Record<string, unknown>);
      if (mapped) {
        bucket.push(mapped);
      }
      if (bucket.length >= 4) {
        break;
      }
    }
    return bucket;
  };

  return {
    entities: slice(source["entities"], (entry) => {
      const name = sanitizeString(entry["name"]);
      const description = sanitizeString(entry["description"]);
      if (!name && !description) {
        return null;
      }
      return {
        id: sanitizeString(entry["id"]),
        name,
        description,
        tweetReferences: sanitizeStringArray(entry["tweet_references"]),
      };
    }),
    beliefsAndValues: slice(source["beliefs_and_values"], (entry) => {
      const belief = sanitizeString(entry["belief"]);
      const description = sanitizeString(entry["description"]);
      if (!belief && !description) {
        return null;
      }
      return {
        id: sanitizeString(entry["id"]),
        belief,
        description,
        tweetReferences: sanitizeStringArray(entry["tweet_references"]),
      };
    }),
    goals: slice(source["goals"], (entry) => {
      const goal = sanitizeString(entry["goal"]);
      const description = sanitizeString(entry["description"]);
      if (!goal && !description) {
        return null;
      }
      return {
        id: sanitizeString(entry["id"]),
        goal,
        description,
        tweetReferences: sanitizeStringArray(entry["tweet_references"]),
      };
    }),
    socialRelationships: slice(source["social_relationships"], (entry) => {
      const username = sanitizeString(entry["username"]);
      const interactionType = sanitizeString(entry["interaction_type"]);
      if (!username && !interactionType) {
        return null;
      }
      return {
        id: sanitizeString(entry["id"]),
        username,
        interactionType,
        tweetReferences: sanitizeStringArray(entry["tweet_references"]),
      };
    }),
    moodsAndEmotionalTones: slice(source["moods_and_emotional_tones"], (entry) => {
      const mood = sanitizeString(entry["mood"]);
      const description = sanitizeString(entry["description"]);
      if (!mood && !description) {
        return null;
      }
      return {
        id: sanitizeString(entry["id"]),
        mood,
        description,
        tweetReferences: sanitizeStringArray(entry["tweet_references"]),
      };
    }),
    keyConcepts: slice(source["key_concepts_and_ideas"], (entry) => {
      const concept = sanitizeString(entry["concept"]);
      const description = sanitizeString(entry["description"]);
      if (!concept && !description) {
        return null;
      }
      return {
        id: sanitizeString(entry["id"]),
        concept,
        description,
        tweetReferences: sanitizeStringArray(entry["tweet_references"]),
      };
    }),
  };
};

const normalizeYearlySummaries = (value: unknown): { period: string; summary: string }[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const bucket: { period: string; summary: string }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const period = sanitizeString(record["period"]);
    const summary = sanitizeString(record["summary"]);
    if (!period && !summary) {
      continue;
    }
    bucket.push({ period, summary });
  }
  return bucket;
};

const userExistenceCache = new Map<string, Promise<boolean>>();

const ensureUserExists = async (username: string): Promise<boolean> => {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return false;
  }

  const cached = userExistenceCache.get(normalized);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const bucket = await getBucketName();
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${normalized}/`,
        MaxKeys: 1,
      }),
    );

    const keyCount = response.KeyCount ?? 0;
    const hasContents = (response.Contents?.length ?? 0) > 0;
    const hasPrefixes = (response.CommonPrefixes?.length ?? 0) > 0;
    return keyCount > 0 || hasContents || hasPrefixes;
  })();

  userExistenceCache.set(normalized, promise);

  try {
    const exists = await promise;
    if (!exists) {
      userExistenceCache.delete(normalized);
    }
    return exists;
  } catch (error) {
    userExistenceCache.delete(normalized);
    throw error;
  }
};

export const listUsers = async (): Promise<string[]> => {
  const bucket = await getBucketName();
  const users = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Delimiter: "/",
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    const prefixes = response.CommonPrefixes ?? [];
    for (const prefix of prefixes) {
      const raw = prefix.Prefix ?? "";
      const name = raw.endsWith("/") ? raw.slice(0, -1) : raw;
      if (!name || name.startsWith(".")) {
        continue;
      }
      users.add(name);
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return Array.from(users).sort((a, b) => a.localeCompare(b));
};

export const getUserSummary = async (inputUsername: string): Promise<UserSummary | null> => {
  const username = normalizeUsername(inputUsername);
  if (!username) {
    return null;
  }

  const exists = await ensureUserExists(username);
  if (!exists) {
    return null;
  }

  const groupData = await readJsonFile<Record<string, unknown>>(username, "group_results.json");
  const params = await readJsonFile<Record<string, unknown>>(username, "clustering_params.json");
  const tweetRows = await loadTweetRows(username);

  let description = "";
  if (groupData && typeof groupData === "object") {
    const summary = sanitizeString((groupData as Record<string, unknown>)["overall_summary"]);
    description = summary.replace(/\s+/g, " ").trim();
  }

  let clusters = 0;
  if (params && typeof params === "object") {
    clusters = Math.max(0, Math.round(sanitizeNumber((params as Record<string, unknown>)["n_clusters"])));
  }

  const accountCounts = new Map<string, number>();
  const followingIds = new Set<string>();
  const followerIds = new Set<string>();
  let likes = 0;
  let tweets = 0;

  for (const row of tweetRows) {
    if (row.accountId) {
      accountCounts.set(row.accountId, (accountCounts.get(row.accountId) ?? 0) + 1);
    }
  }

  let primaryAccount = "";
  for (const [accountId, count] of accountCounts.entries()) {
    if (!primaryAccount || count > (accountCounts.get(primaryAccount) ?? 0)) {
      primaryAccount = accountId;
    }
  }

  if (primaryAccount) {
    for (const row of tweetRows) {
      const favoriteCount = Number.isFinite(row.favoriteCount) ? row.favoriteCount : 0;

      if (row.accountId === primaryAccount) {
        tweets += 1;
        likes += favoriteCount;
        if (row.replyToUserId && row.replyToUserId !== primaryAccount) {
          followingIds.add(row.replyToUserId);
        }
      } else if (row.replyToUserId === primaryAccount && row.accountId) {
        followerIds.add(row.accountId);
      }
    }
  }

  if (tweets === 0) {
    const tweetMap = await readJsonFile<Record<string, Record<string, string>>>(
      username,
      "local_tweet_id_maps.json",
    );
    if (tweetMap && typeof tweetMap === "object") {
      const uniqueIds = new Set<string>();
      for (const cluster of Object.values(tweetMap)) {
        if (!cluster) {
          continue;
        }
        for (const tweetId of Object.values(cluster)) {
          const normalized = sanitizeString(tweetId);
          if (normalized) {
            uniqueIds.add(normalized);
          }
        }
      }
      tweets = uniqueIds.size;
    }
  }

  const handle = `@${username}`;
  let avatarUrl = AVATAR_PLACEHOLDER;
  if (primaryAccount) {
    const avatars = await fetchAvatarsByAccountId([primaryAccount]);
    const resolved = avatars.get(primaryAccount) ?? null;
    if (resolved && resolved.trim().length) {
      avatarUrl = resolved.trim();
    }
  }

  const monthlyTimeline = new Map<string, { count: number; monthStart: number }>();

  if (primaryAccount) {
    for (const row of tweetRows) {
      if (row.accountId !== primaryAccount || row.createdAtMs === null) {
        continue;
      }

      const date = new Date(row.createdAtMs);
      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const monthStart = Date.UTC(year, month, 1);
      const bucketKey = `${year}-${month}`;
      const existing = monthlyTimeline.get(bucketKey);
      if (existing) {
        existing.count += 1;
      } else {
        monthlyTimeline.set(bucketKey, { count: 1, monthStart });
      }
    }
  }

  const tweetsOverTime = Array.from(monthlyTimeline.values())
    .sort((a, b) => a.monthStart - b.monthStart)
    .map(({ monthStart, count }) => ({
      month: new Date(monthStart).toISOString(),
      count,
    }));

  return {
    username,
    handle,
    description,
    clusters,
    tweets,
    followers: followerIds.size,
    following: followingIds.size,
    likes,
    avatarUrl,
    tweetsOverTime,
  };
};

export const getUserClusters = async (inputUsername: string): Promise<UserClusters | null> => {
  const username = normalizeUsername(inputUsername);
  if (!username) {
    return null;
  }

  const hierarchyRows = await readParquetRecords(username, "labeled_cluster_hierarchy.parquet", [
    "cluster_id",
    "name",
    "summary",
    "low_quality_cluster",
    "level",
  ]);
  if (!hierarchyRows.length) {
    return null;
  }

  const hierarchy = hierarchyRows.filter((row) => sanitizeNumber(row["level"]) === 0);
  if (!hierarchy.length) {
    return { clusters: [] };
  }

  const clusterIds = new Set<string>();
  const nameMap = new Map<string, string>();
  for (const row of hierarchy) {
    const clusterId = sanitizeString(row["cluster_id"]);
    if (!clusterId) {
      continue;
    }
    clusterIds.add(clusterId);
    const name = sanitizeString(row["name"]) || clusterId;
    nameMap.set(clusterId, name);
  }

  const ontologyData = await readJsonFile<Record<string, unknown>>(username, "cluster_ontology_items.json");
  const labelsData = await readJsonFile<Record<string, unknown>>(username, "cluster_labels.json");
  const groupData = await readJsonFile<Record<string, unknown>>(username, "group_results.json");
  const tweetIdMaps =
    (await readJsonFile<Record<string, Record<string, string>>>(username, "local_tweet_id_maps.json")) ?? {};

  const yearlyMap = new Map<string, { period: string; summary: string }[]>();
  const ontologyMap = new Map<string, ClusterOntology>();

  const ingestOntologySource = (source: Record<string, unknown> | null | undefined) => {
    if (!source) {
      return;
    }
    for (const [key, rawValue] of Object.entries(source)) {
      const entry = (rawValue ?? {}) as Record<string, unknown>;
      const clusterKeyRaw = entry["cluster_id"] ?? key;
      const clusterKey = sanitizeString(clusterKeyRaw);
      if (!clusterKey || !clusterIds.has(clusterKey)) {
        continue;
      }
      const container =
        entry["ontology_items"] && typeof entry["ontology_items"] === "object"
          ? (entry["ontology_items"] as Record<string, unknown>)
          : entry;
      if (!ontologyMap.has(clusterKey)) {
        ontologyMap.set(clusterKey, normalizeOntology(container));
      }
      if (!yearlyMap.has(clusterKey)) {
        const yearly = normalizeYearlySummaries(container["yearly_summaries"]);
        if (yearly.length) {
          yearlyMap.set(clusterKey, yearly);
        }
      }
    }
  };

  ingestOntologySource(ontologyData);
  ingestOntologySource(labelsData);

  const relatedMap = new Map<string, Map<string, string>>();
  if (groupData && typeof groupData === "object") {
    const groups = (groupData as Record<string, unknown>)["groups"];
    if (Array.isArray(groups)) {
      for (const group of groups) {
        if (!group || typeof group !== "object") {
          continue;
        }
        const membersRaw = (group as Record<string, unknown>)["members"];
        if (!Array.isArray(membersRaw)) {
          continue;
        }
        const members: { id: string; name: string }[] = [];
        for (const entry of membersRaw) {
          if (!entry || typeof entry !== "object") {
            continue;
          }
          const record = entry as Record<string, unknown>;
          const id = sanitizeString(record["id"]);
          if (!id || !clusterIds.has(id)) {
            continue;
          }
          const name = sanitizeString(record["name"]) || nameMap.get(id) || id;
          members.push({ id, name });
        }
        for (const member of members) {
          const store = relatedMap.get(member.id) ?? new Map<string, string>();
          for (const other of members) {
            if (other.id === member.id) {
              continue;
            }
            store.set(other.id, other.name);
          }
          relatedMap.set(member.id, store);
        }
      }
    }
  }

  const tweetRows = await loadTweetRows(username);

  const statsMap = new Map<
    string,
    {
      likes: number[];
      totalLikes: number;
      count: number;
      timestamps: number[];
      replies: Map<string, number>;
      referenceTweets: Map<
        string,
        {
          tweetId: string;
          username: string;
          accountId: string;
          createdAt: string | null;
          fullText: string;
          favoriteCount: number;
        }
      >;
    }
  >();

  for (const row of tweetRows) {
    const clusterId = row.clusterId;
    if (!clusterId || !clusterIds.has(clusterId)) {
      continue;
    }

    const stats =
      statsMap.get(clusterId) ??
      {
        likes: [] as number[],
        totalLikes: 0,
        count: 0,
        timestamps: [] as number[],
        replies: new Map<string, number>(),
        referenceTweets: new Map<
          string,
          {
            tweetId: string;
            username: string;
            accountId: string;
            createdAt: string | null;
            fullText: string;
            favoriteCount: number;
          }
        >(),
      };

    const favorite = Number.isFinite(row.favoriteCount) ? row.favoriteCount : 0;
    stats.likes.push(favorite);
    stats.totalLikes += favorite;
    stats.count += 1;

    if (row.createdAtMs !== null && Number.isFinite(row.createdAtMs)) {
      stats.timestamps.push(row.createdAtMs);
    }

    if (row.replyToUsername) {
      stats.replies.set(row.replyToUsername, (stats.replies.get(row.replyToUsername) ?? 0) + 1);
    }

    if (row.tweetId) {
      stats.referenceTweets.set(row.tweetId, {
        tweetId: row.tweetId,
        username: row.username,
        accountId: row.accountId,
        createdAt: row.createdAt,
        fullText: row.fullText,
        favoriteCount: Math.round(favorite),
      });
    }

    statsMap.set(clusterId, stats);
  }

  const resolveTweetReferences = (clusterId: string, references: string[]): string[] => {
    if (!references.length) {
      return [];
    }
    const mapForCluster = tweetIdMaps?.[clusterId] ?? {};
    const resolved: string[] = [];
    for (const reference of references) {
      const normalized = sanitizeString(reference);
      if (!normalized) {
        continue;
      }
      const mapped = sanitizeString(mapForCluster[normalized]) || normalized;
      resolved.push(mapped);
    }
    return resolved;
  };

  const referenceAccountIds = new Set<string>();
  const remapOntologyReferences = (clusterId: string, ontology: ClusterOntology, collector: Set<string>): ClusterOntology => {
    const remapList = <T extends { tweetReferences: string[] }>(list: T[]): T[] =>
      list.map((item) => {
        const mapped = resolveTweetReferences(clusterId, item.tweetReferences);
        for (const referenceId of mapped) {
          collector.add(referenceId);
        }
        return {
          ...item,
          tweetReferences: mapped,
        };
      });

    return {
      entities: remapList(ontology.entities),
      beliefsAndValues: remapList(ontology.beliefsAndValues),
      goals: remapList(ontology.goals),
      socialRelationships: remapList(ontology.socialRelationships),
      moodsAndEmotionalTones: remapList(ontology.moodsAndEmotionalTones),
      keyConcepts: remapList(ontology.keyConcepts),
    };
  };

  const clusters = hierarchy.map((row) => {
    const clusterId = sanitizeString(row["cluster_id"]);
    const stats = statsMap.get(clusterId);
    const referencedIds = new Set<string>();
    const remappedOntology = remapOntologyReferences(
      clusterId,
      ontologyMap.get(clusterId) ?? normalizeOntology({}),
      referencedIds,
    );
    const tweetsPerMonth = stats ? buildMonthlyTweetSeries(stats.timestamps) : [];
    const referenceDetailsMap = new Map<
      string,
      {
        tweetId: string;
        username: string;
        accountId: string;
        createdAt: string | null;
        fullText: string;
        favoriteCount: number;
        avatarUrl: string;
      }
    >();

    for (const referenceId of referencedIds) {
      const detail = stats?.referenceTweets.get(referenceId);
      if (!detail) {
        continue;
      }
      if (detail.accountId) {
        referenceAccountIds.add(detail.accountId);
      }
      referenceDetailsMap.set(referenceId, {
        tweetId: detail.tweetId,
        username: detail.username,
        accountId: detail.accountId,
        createdAt: detail.createdAt,
        fullText: detail.fullText,
        favoriteCount: detail.favoriteCount,
        avatarUrl: AVATAR_PLACEHOLDER,
      });
    }
    const replies =
      stats && stats.replies.size
        ? Array.from(stats.replies.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([usernameEntry, count]) => ({
              username: usernameEntry,
              count,
            }))
        : [];

    const relatedEntries = relatedMap.get(clusterId);
    const relatedClusters = relatedEntries
      ? Array.from(relatedEntries.entries())
          .filter(([id]) => clusterIds.has(id))
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    return {
      id: clusterId,
      name: sanitizeString(row["name"]) || clusterId,
      summary: sanitizeString(row["summary"]),
      lowQuality: sanitizeBoolean(row["low_quality_cluster"]),
      tweetsCount: stats?.count ?? 0,
      totalLikes: Math.round(stats?.totalLikes ?? 0),
      medianLikes: Math.round(stats ? medianNumber(stats.likes) : 0),
      medianDate: stats ? medianDateIso(stats.timestamps) : null,
      tweetsPerMonth,
      mostRepliedTo: replies,
      relatedClusters,
      yearlySummaries: yearlyMap.get(clusterId) ?? [],
      ontology: remappedOntology,
      ontologyTweetDetails: Object.fromEntries(referenceDetailsMap),
    };
  });

  if (referenceAccountIds.size > 0) {
    const avatars = await fetchAvatarsByAccountId(Array.from(referenceAccountIds));
    for (const cluster of clusters) {
      const entries = cluster.ontologyTweetDetails ? Object.values(cluster.ontologyTweetDetails) : [];
      for (const detail of entries) {
        const resolved = detail.accountId ? avatars.get(detail.accountId) : null;
        detail.avatarUrl = resolved && resolved.trim().length ? resolved.trim() : AVATAR_PLACEHOLDER;
      }
    }
  }

  clusters.sort((a, b) => {
    const aHasDate = a.medianDate ? 1 : 0;
    const bHasDate = b.medianDate ? 1 : 0;
    if (aHasDate !== bHasDate) {
      return bHasDate - aHasDate;
    }
    if (!a.medianDate || !b.medianDate) {
      return 0;
    }
    return Date.parse(b.medianDate) - Date.parse(a.medianDate);
  });

  return { clusters };
};

const detectRetweet = (text: string) => {
  const snippet = text.trim().toLowerCase();
  return snippet.startsWith("rt @");
};

const pickLongestPath = (
  paths: Record<string, string[]> | null,
  rootId: string,
  children: Record<string, string[]>,
): string[] => {
  const fallback = [rootId];
  let best: string[] = [];

  if (paths) {
    for (const path of Object.values(paths)) {
      if (!Array.isArray(path)) {
        continue;
      }
      const normalized = path.map((value) => sanitizeString(value)).filter(Boolean);
      if (!normalized.length) {
        continue;
      }
      if (normalized[0] !== rootId) {
        normalized.unshift(rootId);
      }
      if (normalized.length > best.length) {
        best = normalized;
      }
    }
  }

  if (best.length) {
    return best;
  }

  const stack: string[][] = [[rootId]];
  while (stack.length) {
    const current = stack.pop()!;
    const node = current[current.length - 1];
    const nextChildren = children[node] ?? [];
    if (!nextChildren.length) {
      if (current.length > best.length) {
        best = current;
      }
      continue;
    }
    for (const child of nextChildren) {
      stack.push([...current, child]);
    }
  }

  return best.length ? best : fallback;
};

export const getUserThreads = async (inputUsername: string): Promise<UserThreads | null> => {
  const username = normalizeUsername(inputUsername);
  if (!username) {
    return null;
  }

  const tweetRows = await loadTweetRows(username);
  if (!tweetRows.length) {
    return { threads: [] };
  }

  const threadAccountIds = new Set<string>();

  const tweetLookup = new Map<
    string,
    {
      accountId: string | null;
      cluster: string;
      clusterProb: number;
      username: string;
      createdAt: string | null;
      fullText: string;
      favoriteCount: number;
      replyToTweetId: string;
    }
  >();

  for (const row of tweetRows) {
    const tweetId = row.tweetId;
    if (!tweetId) {
      continue;
    }
    const accountId = row.accountId;
    if (accountId) {
      threadAccountIds.add(accountId);
    }

    tweetLookup.set(tweetId, {
      accountId: accountId || null,
      cluster: row.clusterId,
      clusterProb: Number.isFinite(row.clusterProb) ? row.clusterProb : 0,
      username: row.username,
      createdAt: row.createdAt,
      fullText: row.fullText,
      favoriteCount: Math.round(Number.isFinite(row.favoriteCount) ? row.favoriteCount : 0),
      replyToTweetId: row.replyToTweetId,
    });
  }

  const treesData = (await readPickleFile(username, "trees.pkl")) as Record<string, unknown> | null;
  const incompleteData = (await readPickleFile(username, "incomplete_trees.pkl")) as
    | Record<string, unknown>
    | null;

  const combinedRoots = new Map<
    string,
    {
      tree: Record<string, unknown>;
      isIncomplete: boolean;
    }
  >();

  const ingestTree = (payload: Record<string, unknown> | null, isIncomplete: boolean) => {
    if (!payload) {
      return;
    }
    for (const [key, value] of Object.entries(payload)) {
      const rootId = sanitizeString(key);
      if (!rootId || combinedRoots.has(rootId)) {
        continue;
      }
      if (!value || typeof value !== "object") {
        continue;
      }
      combinedRoots.set(rootId, {
        tree: value as Record<string, unknown>,
        isIncomplete,
      });
    }
  };

  ingestTree(treesData, false);
  ingestTree(incompleteData, true);

  const threads: ThreadEntry[] = [];

  for (const [rootId, payload] of combinedRoots.entries()) {
    const tree = payload.tree;

    const tweetsRaw = tree["tweets"];
    const tweetsMap: Record<string, Record<string, unknown>> =
      tweetsRaw && typeof tweetsRaw === "object"
        ? (tweetsRaw as Record<string, Record<string, unknown>>)
        : {};

    const childrenRaw = tree["children"];
    const children: Record<string, string[]> = {};
    if (childrenRaw && typeof childrenRaw === "object") {
      for (const [parent, childrenList] of Object.entries(childrenRaw as Record<string, unknown>)) {
        const parentId = sanitizeString(parent);
        if (!parentId) {
          continue;
        }
        if (!Array.isArray(childrenList)) {
          continue;
        }
        const normalized = sanitizeStringArray(childrenList);
        if (normalized.length) {
          children[parentId] = normalized;
        }
      }
    }

    const pathsRaw = tree["paths"];
    const paths: Record<string, string[]> | null =
      pathsRaw && typeof pathsRaw === "object"
        ? (pathsRaw as Record<string, string[]>)
        : null;

    const longestPath = pickLongestPath(paths, rootId, children);

    let totalFavorites = 0;
    let maxClusterProb = 0;
    let clusterCandidate = "";
    let rootIsReply = false;
    let containsRetweet = false;
    let rootCreatedAt: string | null = null;
    const tweets: ThreadTweet[] = [];

    longestPath.forEach((tweetId, index) => {
      const lookup = tweetLookup.get(tweetId);
      const fallback = tweetsMap[tweetId] ?? {};

      const accountId =
        lookup?.accountId ||
        sanitizeString((fallback as Record<string, unknown>)["account_id"]) ||
        sanitizeString((fallback as Record<string, unknown>)["user_id"]) ||
        null;
      const username = lookup?.username || sanitizeString((fallback as Record<string, unknown>)["username"]);
      const createdAt =
        lookup?.createdAt ||
        (() => {
          const raw = (fallback as Record<string, unknown>)["created_at"];
          if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
            return raw.toISOString();
          }
          const text = sanitizeString(raw);
          return text || null;
        })();
      const fullText =
        lookup?.fullText || sanitizeString((fallback as Record<string, unknown>)["full_text"]);
      const favoriteCount =
        lookup?.favoriteCount ?? Math.round(sanitizeNumber((fallback as Record<string, unknown>)["favorite_count"]));
      const replyTo =
        lookup?.replyToTweetId || sanitizeString((fallback as Record<string, unknown>)["reply_to_tweet_id"]);
      const clusterId =
        lookup?.cluster || sanitizeString((fallback as Record<string, unknown>)["cluster"]);
      const clusterProb =
        lookup?.clusterProb ?? sanitizeNumber((fallback as Record<string, unknown>)["cluster_prob"]);

      const isReply = Boolean(replyTo);
      const isRetweet = detectRetweet(fullText);

      if (index === 0) {
        rootIsReply = isReply;
        rootCreatedAt = createdAt;
      }
      if (!clusterCandidate && clusterId) {
        clusterCandidate = clusterId;
      }
      if (clusterProb > maxClusterProb) {
        maxClusterProb = clusterProb;
      }
      if (isRetweet) {
        containsRetweet = true;
      }

      totalFavorites += favoriteCount;
      if (accountId) {
        threadAccountIds.add(accountId);
      }

      tweets.push({
        id: tweetId,
        accountId,
        avatarUrl: AVATAR_PLACEHOLDER,
        username,
        createdAt,
        fullText,
        favoriteCount,
        clusterId,
        clusterProb,
        isReply,
        isRetweet,
      });
    });

    if (!tweets.length) {
      continue;
    }

    threads.push({
      id: rootId,
      clusterId: clusterCandidate,
      isIncomplete: payload.isIncomplete,
      rootIsReply,
      containsRetweet,
      totalFavorites,
      rootCreatedAt,
      maxClusterProb,
      tweets,
    });
  }

  const avatarMap =
    threadAccountIds.size > 0
      ? await fetchAvatarsByAccountId(Array.from(threadAccountIds))
      : new Map<string, string | null>();

  for (const thread of threads) {
    for (const tweet of thread.tweets) {
      const key = tweet.accountId ? tweet.accountId.trim() : "";
      const resolved = key ? avatarMap.get(key) : null;
      if (resolved && resolved.trim().length) {
        tweet.avatarUrl = resolved.trim();
      } else {
        tweet.avatarUrl = AVATAR_PLACEHOLDER;
      }
    }
  }

  threads.sort((a, b) => {
    const aHasDate = a.rootCreatedAt ? 1 : 0;
    const bHasDate = b.rootCreatedAt ? 1 : 0;
    if (aHasDate !== bHasDate) {
      return bHasDate - aHasDate;
    }
    if (!a.rootCreatedAt || !b.rootCreatedAt) {
      return 0;
    }
    return Date.parse(b.rootCreatedAt) - Date.parse(a.rootCreatedAt);
  });

  return { threads };
};
