#!/usr/bin/env bun

/**
 * Fix account table schema to match BetterAuth requirements
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function fix() {
  console.log("Fixing account table schema...");

  try {
    // Make accountId nullable (Twitter might use a different field)
    await pool.query(`
      ALTER TABLE account ALTER COLUMN "accountId" DROP NOT NULL;
    `);
    console.log("✓ Made accountId nullable");

    // Make providerId nullable
    await pool.query(`
      ALTER TABLE account ALTER COLUMN "providerId" DROP NOT NULL;
    `);
    console.log("✓ Made providerId nullable");

    console.log("\n✅ Account table schema fixed!");
  } catch (error: any) {
    // Ignore errors if columns are already nullable
    if (error.code === '42804') {
      console.log("✓ Columns are already nullable");
    } else {
      console.error("❌ Fix failed:", error);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

fix();
