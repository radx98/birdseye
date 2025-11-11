#!/usr/bin/env bun

/**
 * Complete database reset - drops and recreates all BetterAuth tables
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function reset() {
  console.log("Resetting BetterAuth database...\n");

  try {
    // Drop all tables in reverse order of dependencies
    console.log("Dropping existing tables...");
    await pool.query('DROP TABLE IF EXISTS verification CASCADE');
    await pool.query('DROP TABLE IF EXISTS session CASCADE');
    await pool.query('DROP TABLE IF EXISTS account CASCADE');
    await pool.query('DROP TABLE IF EXISTS "user" CASCADE');
    console.log("✓ Dropped all tables\n");

    // Create user table
    console.log("Creating tables...");
    await pool.query(`
      CREATE TABLE "user" (
        id TEXT PRIMARY KEY,
        email TEXT,
        "emailVerified" BOOLEAN NOT NULL DEFAULT false,
        name TEXT,
        image TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Created user table");

    // Create session table
    await pool.query(`
      CREATE TABLE session (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        "expiresAt" TIMESTAMP NOT NULL,
        token TEXT NOT NULL UNIQUE,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Created session table");

    // Create account table - fixed schema for BetterAuth
    await pool.query(`
      CREATE TABLE account (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "expiresAt" TIMESTAMP,
        password TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Created account table");

    // Add unique constraint AFTER creating the table
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS account_provider_account_unique
      ON account ("providerId", "accountId");
    `);
    console.log("✓ Added unique constraint on account");

    // Create verification table
    await pool.query(`
      CREATE TABLE verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ Created verification table");

    console.log("\n✅ Database reset completed successfully!");
    console.log("You can now try signing in again.");
  } catch (error) {
    console.error("\n❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

reset();
