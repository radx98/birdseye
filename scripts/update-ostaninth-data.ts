#!/usr/bin/env node

/**
 * Update ostaninth test data to use Twitter ID 187893504
 * Note: Run with Node.js, not Bun, due to parquet-wasm compatibility
 */

const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

const NEW_TWITTER_ID = "187893504";
const NEW_HANDLE = "ostaninth";
const DATA_DIR = join(process.cwd(), "data_sample", "ostaninth");

async function updateParquetFiles() {
  console.log("Loading parquet libraries...");
  const parquet = await import("parquet-wasm/node/arrow2");
  await parquet.default();

  const arrow = await import("apache-arrow");

  // Update tweets_df.parquet
  const tweetsPath = join(DATA_DIR, "tweets_df.parquet");
  console.log("\n📄 Updating tweets_df.parquet...");

  try {
    const tweetsBuffer = readFileSync(tweetsPath);
    const tweetsTable = parquet.readParquet(new Uint8Array(tweetsBuffer));
    const tweetsArrowTable = arrow.tableFromIPC(tweetsTable.intoIPCStream());

    console.log(`  Found ${tweetsArrowTable.numRows} rows`);

    // Get the schema and data
    const schema = tweetsArrowTable.schema;
    const data: any = {};

    // Copy all columns
    for (const field of schema.fields) {
      const columnData = tweetsArrowTable.getChild(field.name);
      if (field.name === 'accountId') {
        // Replace all accountId values with new Twitter ID
        const newAccountIds = Array(tweetsArrowTable.numRows).fill(NEW_TWITTER_ID);
        data[field.name] = newAccountIds;
        console.log(`  ✓ Updated accountId column to ${NEW_TWITTER_ID}`);
      } else if (field.name === 'userName') {
        // Replace userName values with new handle
        const newUserNames = Array(tweetsArrowTable.numRows).fill(NEW_HANDLE);
        data[field.name] = newUserNames;
        console.log(`  ✓ Updated userName column to ${NEW_HANDLE}`);
      } else {
        // Keep original data
        data[field.name] = columnData?.toArray();
      }
    }

    // Create new Arrow table
    const newTable = arrow.tableFromArrays(data);

    // Write to parquet
    const newParquetBuffer = parquet.writeParquet(newTable);
    writeFileSync(tweetsPath, Buffer.from(newParquetBuffer));
    console.log(`  ✅ Saved updated tweets_df.parquet`);

  } catch (error) {
    console.error(`  ❌ Error updating tweets_df.parquet:`, error);
  }

  // Update clustered_tweets_df.parquet
  const clusteredPath = join(DATA_DIR, "clustered_tweets_df.parquet");
  console.log("\n📄 Updating clustered_tweets_df.parquet...");

  try {
    const clusteredBuffer = readFileSync(clusteredPath);
    const clusteredTable = parquet.readParquet(new Uint8Array(clusteredBuffer));
    const clusteredArrowTable = arrow.tableFromIPC(clusteredTable.intoIPCStream());

    console.log(`  Found ${clusteredArrowTable.numRows} rows`);

    const schema = clusteredArrowTable.schema;
    const data: any = {};

    for (const field of schema.fields) {
      const columnData = clusteredArrowTable.getChild(field.name);
      if (field.name === 'accountId') {
        const newAccountIds = Array(clusteredArrowTable.numRows).fill(NEW_TWITTER_ID);
        data[field.name] = newAccountIds;
        console.log(`  ✓ Updated accountId column to ${NEW_TWITTER_ID}`);
      } else if (field.name === 'userName') {
        const newUserNames = Array(clusteredArrowTable.numRows).fill(NEW_HANDLE);
        data[field.name] = newUserNames;
        console.log(`  ✓ Updated userName column to ${NEW_HANDLE}`);
      } else {
        data[field.name] = columnData?.toArray();
      }
    }

    const newTable = arrow.tableFromArrays(data);
    const newParquetBuffer = parquet.writeParquet(newTable);
    writeFileSync(clusteredPath, Buffer.from(newParquetBuffer));
    console.log(`  ✅ Saved updated clustered_tweets_df.parquet`);

  } catch (error) {
    console.error(`  ❌ Error updating clustered_tweets_df.parquet:`, error);
  }
}

async function main() {
  console.log("🔧 Updating ostaninth data for Twitter ID:", NEW_TWITTER_ID);
  console.log("📁 Data directory:", DATA_DIR);

  await updateParquetFiles();

  console.log("\n✅ All updates complete!");
  console.log("\nNext steps:");
  console.log("1. Upload the entire 'data_sample/ostaninth' folder to your S3 bucket");
  console.log("2. Make sure it's in the root of the bucket (not in a subfolder)");
  console.log("3. Log in with Twitter account @ostaninth (ID: 187893504)");
  console.log("4. Click 'Get the Analysis' to see your data!");
}

main().catch(console.error);
