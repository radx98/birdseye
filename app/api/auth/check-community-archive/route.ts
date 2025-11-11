import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL environment variable.");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    // Query the Community Archive Supabase database to check if the account exists
    const url = new URL(`${SUPABASE_URL}/rest/v1/account`);
    url.searchParams.set("account_id", `eq.${accountId}`);
    url.searchParams.set("select", "account_id");
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error("Community Archive API error:", response.status, response.statusText);
      return NextResponse.json({ exists: false });
    }

    const data = await response.json();
    const exists = Array.isArray(data) && data.length > 0;

    return NextResponse.json({ exists });
  } catch (error) {
    console.error("Error checking Community Archive:", error);
    return NextResponse.json({ exists: false });
  }
}
