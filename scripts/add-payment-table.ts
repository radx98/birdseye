#!/usr/bin/env bun

/**
 * Database migration script to add payment table
 * Stores Stripe payment information for users
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function migrate() {
  console.log("Creating payment table...");

  try {
    // Create payment table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        twitter_id TEXT NOT NULL,
        stripe_session_id TEXT NOT NULL UNIQUE,
        stripe_payment_status TEXT NOT NULL,
        amount INTEGER,
        currency TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id)
      );
    `);
    console.log("✓ Created payment table");

    // Create index for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_user_id ON payment(user_id);
    `);
    console.log("✓ Created index on user_id");

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_twitter_id ON payment(twitter_id);
    `);
    console.log("✓ Created index on twitter_id");

    console.log("\n✅ Payment table migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
