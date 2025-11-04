const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL environment variable.");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.");
}

const SUPABASE_PROFILE_TABLE =
  process.env.SUPABASE_PROFILE_TABLE && process.env.SUPABASE_PROFILE_TABLE.trim().length
    ? process.env.SUPABASE_PROFILE_TABLE.trim()
    : "profile";

const PROFILE_ACCOUNT_ID_FIELD =
  process.env.SUPABASE_PROFILE_ACCOUNT_ID_COLUMN &&
  process.env.SUPABASE_PROFILE_ACCOUNT_ID_COLUMN.trim().length
    ? process.env.SUPABASE_PROFILE_ACCOUNT_ID_COLUMN.trim()
    : "account_id";
const PROFILE_AVATAR_FIELD =
  process.env.SUPABASE_PROFILE_AVATAR_COLUMN &&
  process.env.SUPABASE_PROFILE_AVATAR_COLUMN.trim().length
    ? process.env.SUPABASE_PROFILE_AVATAR_COLUMN.trim()
    : "avatar_media_url";

const buildSupabaseUrl = (path: string) => {
  const trimmed = SUPABASE_URL.endsWith("/") ? SUPABASE_URL.slice(0, -1) : SUPABASE_URL;
  return `${trimmed}${path}`;
};

const ACCOUNT_ID_ALIAS = "alias_account_id";
const AVATAR_ALIAS = "alias_avatar";

type NormalizedProfileRecord = {
  accountId: string;
  avatarUrl: string | null;
};

type FetchAttemptResult = {
  success: boolean;
  records: NormalizedProfileRecord[];
};

const buildInClause = (accountIds: string[]) => {
  const formatted = accountIds
    .map((value) => value.trim())
    .filter((value) => value.length)
    .map((value) => {
      const isNumeric = /^-?\d+(\.\d+)?$/.test(value);
      if (isNumeric) {
        return value;
      }
      const escaped = value.replace(/"/g, '""');
      return `"${escaped}"`;
    });

  if (!formatted.length) {
    return null;
  }

  return `in.(${formatted.join(",")})`;
};

const fetchProfileChunk = async (accountIds: string[]): Promise<FetchAttemptResult> => {
  const inClause = buildInClause(accountIds);
  if (!inClause) {
    return { success: true, records: [] };
  }

  const tablePath = `/rest/v1/${SUPABASE_PROFILE_TABLE}`;
  const url = new URL(buildSupabaseUrl(tablePath));

  url.searchParams.set(
    "select",
    [`${ACCOUNT_ID_ALIAS}:${PROFILE_ACCOUNT_ID_FIELD}`, `${AVATAR_ALIAS}:${PROFILE_AVATAR_FIELD}`].join(","),
  );
  url.searchParams.set(PROFILE_ACCOUNT_ID_FIELD, inClause);

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.warn(
      `[supabase][profiles] request failed`,
      JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        body: text,
      }),
    );
    return { success: false, records: [] };
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(payload)) {
    return { success: true, records: [] };
  }

  const records: NormalizedProfileRecord[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const accountIdRaw = record[ACCOUNT_ID_ALIAS];
    if (accountIdRaw === null || accountIdRaw === undefined) {
      continue;
    }
    const accountIdText = String(accountIdRaw).trim();
    if (!accountIdText.length) {
      continue;
    }
    const avatarRaw = record[AVATAR_ALIAS];
    const avatarUrl =
      typeof avatarRaw === "string" && avatarRaw.trim().length ? avatarRaw.trim() : null;
    records.push({ accountId: accountIdText, avatarUrl });
  }

  return { success: true, records };
};

export const fetchAvatarsByAccountId = async (
  accountIds: string[],
): Promise<Map<string, string | null>> => {
  if (!accountIds.length) {
    return new Map();
  }

  const normalize = (value: string) => value.trim();
  const unique = Array.from(
    new Set(
      accountIds
        .map((value) => (typeof value === "string" ? value : String(value)))
        .map((value) => normalize(value))
        .filter((value) => value.length),
    ),
  );

  if (!unique.length) {
    return new Map();
  }

  const CHUNK_SIZE = 50;
  const results = new Map<string, string | null>();

  for (let start = 0; start < unique.length; start += CHUNK_SIZE) {
    const slice = unique.slice(start, start + CHUNK_SIZE);
    const sliceKeys = new Set(slice);
    const { success, records } = await fetchProfileChunk(slice);

    if (success) {
      for (const record of records) {
        const key = normalize(record.accountId);
        if (!key.length) {
          continue;
        }
        if (record.avatarUrl && record.avatarUrl.length) {
          results.set(key, record.avatarUrl);
        } else if (!results.has(key)) {
          results.set(key, null);
        }
        sliceKeys.delete(key);
      }
    }

    for (const key of sliceKeys) {
      if (!results.has(key)) {
        results.set(key, null);
      }
    }
  }

  for (const key of unique) {
    if (!results.has(key)) {
      results.set(key, null);
    }
  }

  return results;
};
