#!/usr/bin/env bun

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function check() {
  console.log("Checking database contents...\n");

  try {
    // Check user table
    const users = await pool.query('SELECT * FROM "user"');
    console.log("=== USERS TABLE ===");
    console.log(`Found ${users.rows.length} user(s):`);
    users.rows.forEach((user) => {
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log();
    });

    // Check account table
    const accounts = await pool.query('SELECT * FROM account');
    console.log("=== ACCOUNTS TABLE ===");
    console.log(`Found ${accounts.rows.length} account(s):`);
    accounts.rows.forEach((account) => {
      console.log(`  ID: ${account.id}`);
      console.log(`  User ID: ${account.userId}`);
      console.log(`  Provider ID: ${account.providerId}`);
      console.log(`  Account ID: ${account.accountId}`);
      console.log(`  Has Access Token: ${!!account.accessToken}`);
      console.log(`  Created: ${account.createdAt}`);
      console.log();
    });

    // Check session table
    const sessions = await pool.query('SELECT * FROM session');
    console.log("=== SESSIONS TABLE ===");
    console.log(`Found ${sessions.rows.length} session(s):`);
    sessions.rows.forEach((session) => {
      console.log(`  ID: ${session.id}`);
      console.log(`  User ID: ${session.userId}`);
      console.log(`  Expires: ${session.expiresAt}`);
      console.log();
    });
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

check();
