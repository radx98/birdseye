#!/usr/bin/env bun

/**
 * Cleanup script - removes all auth data
 * Run this if you're having issues with auth
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function cleanup() {
  console.log("Cleaning up BetterAuth tables...");

  try {
    // Delete in reverse order of dependencies
    await pool.query('DELETE FROM verification');
    console.log("✓ Cleared verification table");

    await pool.query('DELETE FROM session');
    console.log("✓ Cleared session table");

    await pool.query('DELETE FROM account');
    console.log("✓ Cleared account table");

    await pool.query('DELETE FROM "user"');
    console.log("✓ Cleared user table");

    console.log("\n✅ Database cleanup completed successfully!");
    console.log("You can now try signing in again.");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanup();
