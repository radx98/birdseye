# Authentication Setup Guide

This guide explains how to complete the BetterAuth + Twitter OAuth setup for Birdseye.

## What Was Implemented

### 1. **BetterAuth Integration**
- ✅ Installed `better-auth`, `pg`, `@supabase/supabase-js` and related dependencies
- ✅ Created server-side auth configuration ([lib/auth.ts](lib/auth.ts))
- ✅ Created client-side auth hooks ([lib/auth-client.ts](lib/auth-client.ts))
- ✅ Set up Twitter OAuth provider with existing credentials from `.env`
- ✅ Added custom fields to store `twitterId` and `twitterUsername`

### 2. **New User Flow**
- ✅ **Sign In Section**: Shows slideshow with example1-4.png images and "Sign In" button for unauthenticated users
- ✅ **Get Started Section**: Shows after user logs in, with "Get the Analysis" button
- ✅ **User-Specific Data**: After clicking "Get the Analysis", only that user's data is loaded
- ✅ **Admin Mode**: Users with IDs in `ADMIN_ID_1` or `ADMIN_ID_2` see the full admin interface with user selection dropdown

### 3. **Components Created**
- [components/auth/SignInSection.tsx](components/auth/SignInSection.tsx) - Sign in page with slideshow
- [components/auth/GetStartedSection.tsx](components/auth/GetStartedSection.tsx) - Get started page for logged-in users
- [components/MainContent.tsx](components/MainContent.tsx) - Main content switcher based on auth state
- [lib/auth-utils.ts](lib/auth-utils.ts) - Utility functions for admin role checking
- [app/api/auth/[...all]/route.ts](app/api/auth/[...all]/route.ts) - BetterAuth API routes
- [app/api/auth/is-admin/route.ts](app/api/auth/is-admin/route.ts) - Admin status checker
- [app/api/auth/find-username/route.ts](app/api/auth/find-username/route.ts) - Maps Twitter ID to username

### 4. **Modified Files**
- [app/page.tsx](app/page.tsx) - Now uses MainContent component
- [components/user-explorer/context.tsx](components/user-explorer/context.tsx) - Added single-user mode support
- [components/user-explorer/SelectUserPanel.tsx](components/user-explorer/SelectUserPanel.tsx) - Hides dropdown in single-user mode

## Setup Steps

### Step 1: Configure Database URL

Update the `DATABASE_URL` in [.env](.env):

```bash
# Get this from Supabase Dashboard > Project Settings > Database > Connection string (Direct connection)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.fabxmporizzqflnftavs.supabase.co:5432/postgres
```

Replace `[YOUR-PASSWORD]` with your actual Supabase database password.

### Step 2: Create Database Tables

Better Auth will automatically create the necessary tables on first run, but you need to ensure the database is accessible. The required tables are:
- `user`
- `session`
- `account`
- `verification`

Better Auth uses automatic schema migration, so these tables will be created when you first start the app and a user tries to sign in.

### Step 3: Configure Twitter OAuth Callback

In your [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard):

1. Go to your app settings
2. Add the callback URL:
   - Development: `http://localhost:3000/api/auth/callback/twitter`
   - Production: `https://yourdomain.com/api/auth/callback/twitter`

3. Ensure the app has OAuth 2.0 enabled with the following scopes:
   - `tweet.read`
   - `users.read`
   - `offline.access` (if you want refresh tokens)

### Step 4: Test the Application

1. Start the development server:
   ```bash
   bun dev
   ```

2. Visit `http://localhost:3000`

3. You should see:
   - **Key Features section** (always visible)
   - **Sign In section** with slideshow and "Sign In" button

4. Click "Sign In" and authenticate with Twitter

5. After authentication:
   - **Admins** (Twitter IDs in ADMIN_ID_1 or ADMIN_ID_2): See full interface with "Select a User" dropdown
   - **Regular users**: See "Get Started" section with "Get the Analysis" button

6. Regular users click "Get the Analysis" to load their data

## User Flow

### For First-Time Users (Not Admin)
1. Land on page → See Key Features + Sign In section
2. Click "Sign In" → Twitter OAuth flow
3. After login → See Get Started section
4. Click "Get the Analysis" → Load their specific user data
5. See only their own analysis (no dropdown to select other users)

### For Admin Users
1. Land on page → See Key Features + Select a User section (full admin interface)
2. Can select any user from dropdown
3. See all analysis features for any user

## Environment Variables Reference

```bash
# Twitter OAuth (already configured)
TWITTER_CLIENT_ID=U2hhOTZUOEZMUVdxRlVpTUlUMU46MTpjaQ
TWITTER_CLIENT_SECRET=R5nnNtC4nZAQeSa6SoDZkl1ZgkFRZpdwmj7pWBtzs20IycF72k

# Admin User IDs (Twitter account IDs)
ADMIN_ID_1=322603863
ADMIN_ID_2=187893504

# Better Auth Configuration
BETTER_AUTH_SECRET=wMjs+suQKNzJGCSE9Goj+g1GKHqUfJb2pU+7kVY7xYs=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

# Database (REQUIRED - must be configured)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.fabxmporizzqflnftavs.supabase.co:5432/postgres
```

## How User Identification Works

1. User logs in with Twitter OAuth
2. BetterAuth captures their **Twitter user ID** (numeric ID, e.g., "322603863")
3. This is stored in `user.twitterId` field in the database
4. When user clicks "Get the Analysis", the app:
   - Calls `/api/auth/find-username` with their Twitter ID
   - Searches all user directories in S3
   - Loads `clustered_tweets_df.parquet` for each user
   - Finds which username's `account_id` matches the Twitter ID
   - Auto-selects that user's data
5. User can only see their own data (no dropdown to switch users)

## Troubleshooting

### "Your Twitter account data is not available yet"
This means the user's Twitter ID doesn't match any `account_id` in the S3 user directories. Possible causes:
- User's tweets haven't been processed and uploaded to S3 yet
- The `account_id` in the tweet data doesn't match their Twitter user ID
- The user directory hasn't been created

### Database Connection Errors
- Verify `DATABASE_URL` is correct
- Check Supabase database is running
- Ensure database password is correct
- Check network connectivity to Supabase

### Twitter OAuth Errors
- Verify callback URL is configured in Twitter Developer Portal
- Check `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` are correct
- Ensure your Twitter app has OAuth 2.0 enabled

### Admin Access Not Working
- Verify the Twitter user ID matches one of the IDs in `ADMIN_ID_1` or `ADMIN_ID_2`
- Check the `/api/auth/is-admin` endpoint is returning the correct `isAdmin` value
- Clear browser cookies and re-authenticate

## Production Deployment

For production, update these environment variables:

```bash
BETTER_AUTH_URL=https://yourdomain.com
NEXT_PUBLIC_BETTER_AUTH_URL=https://yourdomain.com
```

And configure the Twitter OAuth callback URL to use your production domain.

## Security Notes

- ✅ Email/password authentication is disabled (Twitter OAuth only)
- ✅ Admin access is controlled by Twitter user IDs in environment variables
- ✅ Regular users can only see their own data
- ✅ Session expires after 7 days
- ✅ BetterAuth secret is randomly generated and unique
- ⚠️ Keep your `BETTER_AUTH_SECRET` and database credentials secure
- ⚠️ Do not commit `.env` file to version control

## Next Steps

1. Configure `DATABASE_URL` in `.env`
2. Set up Twitter OAuth callback URL
3. Test the authentication flow
4. Process and upload user tweet data to S3
5. Deploy to production
