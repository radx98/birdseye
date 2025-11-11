import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth-utils";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ isAdmin: false, twitterId: null, username: null });
    }

    console.log("User ID:", session.user.id);

    // Query the database directly to get the Twitter account
    const result = await pool.query(
      'SELECT * FROM account WHERE "userId" = $1 AND "providerId" = $2',
      [session.user.id, "twitter"]
    );

    console.log("Account query result:", result.rows);

    const twitterAccount = result.rows[0];
    const twitterId = twitterAccount?.accountId || null;

    console.log("Twitter account:", twitterAccount);
    console.log("Twitter ID:", twitterId);

    // Fetch username from Community Archive database
    let username = null;
    if (twitterId && SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const url = new URL(`${SUPABASE_URL}/rest/v1/account`);
        url.searchParams.set("account_id", `eq.${twitterId}`);
        url.searchParams.set("select", "username");
        url.searchParams.set("limit", "1");

        const response = await fetch(url.toString(), {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Accept: "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            username = data[0].username || null;
            console.log("Username from Community Archive:", username);
          }
        }
      } catch (error) {
        console.error("Error fetching username from Community Archive:", error);
      }
    }

    return NextResponse.json({
      isAdmin: isAdmin(twitterId),
      twitterId,
      username,
    });
  } catch (error) {
    console.error("Error checking admin status:", error);
    return NextResponse.json({ isAdmin: false, twitterId: null, username: null });
  }
}
