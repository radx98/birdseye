# Stripe Integration Setup

This document describes the Stripe payment integration for Birdseye.

## Overview

Users who are in the Community Archive database must complete a payment before accessing their analysis. The payment flow is handled through Stripe Checkout (hosted by Stripe).

## Architecture

### Payment Flow

1. User logs in with Twitter OAuth
2. System checks if user exists in Community Archive DB
3. If user exists, system checks if they have a payment record
4. **If no payment:** "Get the Analysis" button redirects to Stripe Checkout
5. **If payment exists:** User's data loads immediately
6. After successful payment, user is redirected back to Birdseye and their data loads automatically

### Admin Users

Admin users (defined by `ADMIN_ID_1` and `ADMIN_ID_2` environment variables) are **not affected** by payment requirements. They can access any user's data without payment.

## Database Schema

### Payment Table

```sql
CREATE TABLE payment (
  id TEXT PRIMARY KEY,
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
```

The `payment` table stores one record per user who has completed payment. The `stripe_payment_status` field should be `'paid'` for successful payments.

## Files Created/Modified

### New Files

1. **[lib/stripe.ts](lib/stripe.ts)** - Stripe SDK initialization
2. **[app/api/checkout_sessions/route.ts](app/api/checkout_sessions/route.ts)** - Create Stripe checkout sessions
3. **[app/api/webhooks/route.ts](app/api/webhooks/route.ts)** - Handle Stripe webhook events
4. **[app/api/auth/check-payment/route.ts](app/api/auth/check-payment/route.ts)** - Check if user has paid
5. **[scripts/add-payment-table.ts](scripts/add-payment-table.ts)** - Database migration script

### Modified Files

1. **[components/auth/GetStartedSection.tsx](components/auth/GetStartedSection.tsx)** - Added payment check and checkout redirect
2. **[components/MainContent.tsx](components/MainContent.tsx)** - Added payment status check and success redirect handling

## Environment Variables

Add these to your `.env` file:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # Set this in production
STRIPE_PRICE_ID=price_...  # Your Stripe product price ID
```

### Getting the Values

- **Publishable Key & Secret Key**: Get these from [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
- **Price ID**: Create a product in [Stripe Dashboard → Products](https://dashboard.stripe.com/products) and copy the price ID
- **Webhook Secret**: See "Setting Up Webhooks" section below

## Setting Up Webhooks

Webhooks are required to receive payment confirmation events from Stripe.

### Development (Local Testing)

1. Install the Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login to your Stripe account:
   ```bash
   stripe login
   ```

3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks
   ```

4. Copy the webhook signing secret (starts with `whsec_`) and add it to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Production

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set the endpoint URL to: `https://your-domain.com/api/webhooks`
4. Select events to listen to:
   - `checkout.session.completed`
5. Click "Add endpoint"
6. Copy the "Signing secret" and add it to your production environment variables

## Database Migration

Run the migration to create the payment table:

```bash
bun run scripts/add-payment-table.ts
```

## Testing the Integration

### Test Mode

Stripe provides test card numbers for testing:

- **Success**: `4242 4242 4242 4242`
- **Requires authentication**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 9995`

Use any future expiry date, any 3-digit CVC, and any postal code.

### Testing Flow

1. Log in with a Twitter account that exists in Community Archive
2. Ensure the account is **not** an admin account
3. Click "Get the Analysis" button
4. You should be redirected to Stripe Checkout
5. Complete payment with test card `4242 4242 4242 4242`
6. After successful payment, you should be redirected back to Birdseye
7. Your analysis data should load automatically
8. Log out and log back in - data should still load automatically

## Troubleshooting

### Payment not recorded after successful checkout

- Check that the webhook endpoint is correctly configured
- Check server logs for webhook errors
- Verify `STRIPE_WEBHOOK_SECRET` is set correctly
- Use Stripe Dashboard → Webhooks → Events to see webhook delivery status

### User stuck on "Get the Analysis" button after payment

- Check the `payment` table in the database to verify the record was created
- Check that `stripe_payment_status` is `'paid'`
- Try refreshing the page or logging out/in

### Webhook signature verification fails

- Ensure `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint secret in Stripe Dashboard
- In development, make sure the Stripe CLI is running with `stripe listen`

## Price Configuration

The current price ID is set in `.env` as `STRIPE_PRICE_ID`. To change the price:

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Create a new product or edit existing
3. Copy the price ID (starts with `price_`)
4. Update `STRIPE_PRICE_ID` in your environment variables

## Security Notes

- Never commit `.env` file to version control
- Use test keys for development, live keys for production
- Webhook signature verification is enabled in production (requires `STRIPE_WEBHOOK_SECRET`)
- In development without webhook secret, signature verification is skipped (shows warning in console)
- User metadata (user ID, Twitter ID) is stored in Stripe checkout session for tracking
- Payment records are tied to Better Auth user accounts

## Sample Code Reference

The implementation was adapted from the official Stripe Next.js sample code in the [stripe-sample-code](stripe-sample-code/) directory (not modified, kept for reference).
