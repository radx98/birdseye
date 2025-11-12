import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth-utils";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

/**
 * Get ADMIN_ID_1 Twitter ID for admin preview functionality
 * Only accessible by admin users
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query the database to get the Twitter account
    const result = await pool.query(
      'SELECT * FROM account WHERE "userId" = $1 AND "providerId" = $2',
      [session.user.id, "twitter"]
    );

    const twitterAccount = result.rows[0];
    const twitterId = twitterAccount?.accountId || null;

    // Check if user is admin
    if (!isAdmin(twitterId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return ADMIN_ID_1 from environment
    const adminId1 = process.env.ADMIN_ID_1 || null;

    return NextResponse.json({
      adminId1,
    });
  } catch (error) {
    console.error("Error getting ADMIN_ID_1:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
