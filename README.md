# Birdseye

Birdseye helps you explore patterns in your tweet history by automatically clustering your tweets into topics. Built on top of the [Community Archive](https://www.community-archive.org/), it uses AI-powered analysis to provide insights into your social media presence.

## Features

- **Automatic Topic Clustering**: Your tweets are automatically organized into meaningful clusters using AI
- **Visual Analytics**: Interactive scatter plots and timeline charts to explore your tweet history
- **Thread Reconstruction**: View complete conversation threads and tweet chains
- **AI-Generated Insights**: Yearly summaries, ontologies, and key concept extraction
- **Engagement Metrics**: Track likes, retweets, and interaction patterns over time

## Tech Stack

- **Framework**: Next.js 16 with App Router and React 19
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4
- **Authentication**: BetterAuth with Twitter OAuth
- **Database**: PostgreSQL (via Supabase)
- **Storage**: AWS S3-compatible storage (Supabase)
- **Data Processing**: Apache Arrow, Parquet, NumPy
- **Visualization**: D3.js
- **Payments**: Stripe
- **Runtime**: Bun