#!/usr/bin/env python3
"""
Update ostaninth test data to use Twitter ID 187893504
"""

import pandas as pd
import os

NEW_TWITTER_ID = "187893504"
NEW_HANDLE = "ostaninth"
DATA_DIR = os.path.join(os.getcwd(), "data_sample", "ostaninth")

def update_parquet_file(filename, description):
    filepath = os.path.join(DATA_DIR, filename)

    if not os.path.exists(filepath):
        print(f"⚠️  {filename} not found, skipping...")
        return

    print(f"\n📄 Updating {filename}...")

    try:
        # Read parquet file
        df = pd.read_parquet(filepath)
        print(f"  Found {len(df)} rows")

        # Update account_id column if it exists (snake_case)
        if 'account_id' in df.columns:
            old_ids = df['account_id'].unique()
            print(f"  Old account_id values: {old_ids[:3]}...")  # Show first 3
            df['account_id'] = NEW_TWITTER_ID
            print(f"  ✓ Updated account_id column to {NEW_TWITTER_ID}")
        elif 'accountId' in df.columns:  # Try camelCase too
            old_ids = df['accountId'].unique()
            print(f"  Old accountId values: {old_ids[:3]}...")
            df['accountId'] = NEW_TWITTER_ID
            print(f"  ✓ Updated accountId column to {NEW_TWITTER_ID}")

        # Update username column if it exists
        if 'username' in df.columns:
            old_names = df['username'].unique()
            print(f"  Old username values: {old_names[:3]}...")
            df['username'] = NEW_HANDLE
            print(f"  ✓ Updated username column to {NEW_HANDLE}")
        elif 'userName' in df.columns:  # Try camelCase too
            df['userName'] = NEW_HANDLE
            print(f"  ✓ Updated userName column to {NEW_HANDLE}")

        # Write back to parquet
        df.to_parquet(filepath, index=False)
        print(f"  ✅ Saved updated {filename}")

    except Exception as e:
        print(f"  ❌ Error updating {filename}: {e}")

def main():
    print("🔧 Updating ostaninth data for Twitter ID:", NEW_TWITTER_ID)
    print("📁 Data directory:", DATA_DIR)

    # Check if pandas and pyarrow are installed
    try:
        import pyarrow
        print("✓ pandas and pyarrow are installed\n")
    except ImportError:
        print("❌ Error: pyarrow is required. Install with:")
        print("   pip install pandas pyarrow")
        return

    # Update parquet files
    update_parquet_file("tweets_df.parquet", "Main tweets data")
    update_parquet_file("clustered_tweets_df.parquet", "Clustered tweets data")

    print("\n✅ All updates complete!")
    print("\nNext steps:")
    print("1. Upload the entire 'data_sample/ostaninth' folder to your S3 bucket")
    print("2. Make sure it's at: s3://your-bucket/ostaninth/")
    print("3. Log in with Twitter account @ostaninth (ID: 187893504)")
    print("4. Click 'Get the Analysis' to see your data!")

if __name__ == "__main__":
    main()
