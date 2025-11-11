#!/usr/bin/env bun

/**
 * Update duplicated user data to match a different Twitter account
 * Usage: bun run scripts/update-test-user.ts <username> <new-twitter-id> <new-handle>
 * Example: bun run scripts/update-test-user.ts ostaninth 187893504 ostaninth
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const [username, newTwitterId, newHandle] = process.argv.slice(2);

if (!username || !newTwitterId || !newHandle) {
  console.error("Usage: bun run scripts/update-test-user.ts <username> <new-twitter-id> <new-handle>");
  console.error("Example: bun run scripts/update-test-user.ts ostaninth 187893504 ostaninth");
  process.exit(1);
}

const dataDir = join(process.cwd(), "data_sample", username);

try {
  // Update summary.json
  console.log(`Updating ${username}/summary.json...`);
  const summaryPath = join(dataDir, "summary.json");
  const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));

  const oldAccountId = summary.account_id;
  const oldHandle = summary.handle;

  summary.account_id = newTwitterId;
  summary.handle = newHandle;

  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Updated account_id: ${oldAccountId} → ${newTwitterId}`);
  console.log(`✓ Updated handle: ${oldHandle} → ${newHandle}`);

  // Update clusters.json (optional - just tweet metadata)
  try {
    console.log("\nUpdating clusters.json...");
    const clustersPath = join(dataDir, "clusters.json");
    const clusters = JSON.parse(readFileSync(clustersPath, "utf-8"));

    let tweetCount = 0;
    clusters.clusters?.forEach((cluster: any) => {
      cluster.sample_tweets?.forEach((tweet: any) => {
        if (tweet.userId) {
          tweet.userId = newTwitterId;
          tweetCount++;
        }
        if (tweet.userName) {
          tweet.userName = newHandle;
        }
      });
    });

    writeFileSync(clustersPath, JSON.stringify(clusters, null, 2));
    console.log(`✓ Updated ${tweetCount} tweets in clusters.json`);
  } catch (err) {
    console.log("⚠ Skipped clusters.json (file not found or invalid)");
  }

  // Update threads.json (optional)
  try {
    console.log("\nUpdating threads.json...");
    const threadsPath = join(dataDir, "threads.json");
    const threads = JSON.parse(readFileSync(threadsPath, "utf-8"));

    let threadCount = 0;
    threads.threads?.forEach((thread: any) => {
      thread.tweets?.forEach((tweet: any) => {
        if (tweet.userId) {
          tweet.userId = newTwitterId;
          threadCount++;
        }
        if (tweet.userName) {
          tweet.userName = newHandle;
        }
      });
    });

    writeFileSync(threadsPath, JSON.stringify(threads, null, 2));
    console.log(`✓ Updated ${threadCount} tweets in threads.json`);
  } catch (err) {
    console.log("⚠ Skipped threads.json (file not found or invalid)");
  }

  console.log("\n✅ User data updated successfully!");
  console.log(`\nYou can now access this data by:`);
  console.log(`1. Logging in with Twitter account: @${newHandle} (ID: ${newTwitterId})`);
  console.log(`2. Or selecting user from dropdown if you're an admin`);

} catch (error) {
  console.error("❌ Error updating user data:", error);
  process.exit(1);
}
