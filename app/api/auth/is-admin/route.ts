import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth-utils";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ isAdmin: false, twitterId: null });
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

    return NextResponse.json({
      isAdmin: isAdmin(twitterId),
      twitterId,
    });
  } catch (error) {
    console.error("Error checking admin status:", error);
    return NextResponse.json({ isAdmin: false, twitterId: null });
  }
}
