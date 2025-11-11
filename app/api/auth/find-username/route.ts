import { NextResponse } from "next/server";
import { listUsers, getUserSummary } from "@/lib/storage-data";

export async function POST(request: Request) {
  try {
    const { twitterId } = await request.json();
    console.log("🔍 Finding username for Twitter ID:", twitterId);

    if (!twitterId) {
      console.error("❌ No Twitter ID provided");
      return NextResponse.json({ error: "Twitter ID is required" }, { status: 400 });
    }

    // List all users
    const users = await listUsers();
    console.log(`📋 Searching through ${users.length} users...`);

    // Search for the user whose account_id matches the Twitter ID
    for (const username of users) {
      try {
        const summary = await getUserSummary(username);
        console.log(`  Checking @${username}: accountId = "${summary.accountId}"`);

        // Check if this user's account ID matches the Twitter ID
        if (summary.accountId === twitterId) {
          console.log(`✅ Found match! Username: ${username}`);
          return NextResponse.json({ username });
        }
      } catch (error) {
        // Skip users that can't be loaded
        console.error(`Failed to load user ${username}:`, error);
        continue;
      }
    }

    // No matching user found
    console.warn(`⚠️  No match found for Twitter ID: ${twitterId}`);
    return NextResponse.json({ username: null }, { status: 404 });
  } catch (error) {
    console.error("Error finding username:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
