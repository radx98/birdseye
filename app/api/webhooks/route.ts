import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { pool } from "@/lib/auth";

export async function POST(req: Request) {
  let event;

  try {
    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { message: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // Only verify webhook signature if secret is set (production)
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // In development, parse the event directly
      console.warn(
        "STRIPE_WEBHOOK_SECRET not set - skipping signature verification"
      );
      event = JSON.parse(body);
    }
  } catch (err: any) {
    const errorMessage = err.message;
    console.error("Webhook signature verification failed:", errorMessage);
    return NextResponse.json(
      { message: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    );
  }

  const permittedEvents = ["checkout.session.completed"];

  if (permittedEvents.includes(event.type)) {
    try {
      switch (event.type) {
        case "checkout.session.completed":
          const session = event.data.object;
          console.log(`Checkout session completed: ${session.id}`);
          console.log(`Payment status: ${session.payment_status}`);

          // Extract user data from metadata
          const userId = session.metadata?.userId;
          const twitterId = session.metadata?.twitterId;

          if (!userId || !twitterId) {
            console.error("Missing user metadata in checkout session");
            break;
          }

          // Store payment information in database
          await pool.query(
            `INSERT INTO payment (user_id, twitter_id, stripe_session_id, stripe_payment_status, amount, currency, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET
               stripe_session_id = EXCLUDED.stripe_session_id,
               stripe_payment_status = EXCLUDED.stripe_payment_status,
               amount = EXCLUDED.amount,
               currency = EXCLUDED.currency,
               updated_at = NOW()`,
            [
              userId,
              twitterId,
              session.id,
              session.payment_status,
              session.amount_total,
              session.currency,
            ]
          );

          console.log(`Payment recorded for user ${userId} (Twitter: ${twitterId})`);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error: any) {
      console.error("Webhook handler error:", error);
      return NextResponse.json(
        { message: "Webhook handler failed" },
        { status: 500 }
      );
    }
  }

  // Return a response to acknowledge receipt of the event
  return NextResponse.json({ message: "Received" }, { status: 200 });
}
