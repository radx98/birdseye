#!/usr/bin/env bun

/**
 * Add missing fields to account table for BetterAuth Twitter OAuth
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function addFields() {
  console.log("Adding missing account table fields...\n");

  try {
    // Add accessTokenExpiresAt if it doesn't exist
    await pool.query(`
      ALTER TABLE account ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMP;
    `);
    console.log("✓ Added accessTokenExpiresAt");

    // Add scope if it doesn't exist
    await pool.query(`
      ALTER TABLE account ADD COLUMN IF NOT EXISTS scope TEXT;
    `);
    console.log("✓ Added scope");

    // Add data field for extra OAuth data
    await pool.query(`
      ALTER TABLE account ADD COLUMN IF NOT EXISTS data TEXT;
    `);
    console.log("✓ Added data");

    console.log("\n✅ Account table updated successfully!");
  } catch (error) {
    console.error("\n❌ Update failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addFields();
