import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { pool } from "@/lib/auth";

export async function POST() {
  try {
    console.log("=== Checkout session creation started ===");

    // Get authenticated user session
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    console.log("Session:", session ? { userId: session.user.id, email: session.user.email } : "null");

    if (!session?.user) {
      console.error("Unauthorized: No session or user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user's Twitter account ID
    console.log("Querying for Twitter account with userId:", session.user.id);
    const result = await pool.query(
      'SELECT * FROM account WHERE "userId" = $1 AND "providerId" = $2',
      [session.user.id, "twitter"]
    );

    console.log("Twitter account query result:", result.rows.length, "rows");

    if (!result.rows || result.rows.length === 0) {
      console.error("Twitter account not found for user:", session.user.id);
      return NextResponse.json(
        { error: "Twitter account not found" },
        { status: 404 }
      );
    }

    const twitterId = result.rows[0].accountId;
    console.log("Twitter ID:", twitterId);

    const origin = headersList.get("origin") || process.env.BETTER_AUTH_URL || "http://localhost:3000";
    console.log("Origin:", origin);
    console.log("STRIPE_PRICE_ID:", process.env.STRIPE_PRICE_ID);

    // Create Checkout Session with user metadata
    console.log("Creating Stripe checkout session...");
    const checkoutSession = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment_canceled=true`,
      // automatic_tax: { enabled: true }, // Disabled - requires origin address configuration in Stripe dashboard
      metadata: {
        userId: session.user.id,
        twitterId: twitterId,
      },
      customer_email: session.user.email || undefined,
    });

    console.log("Checkout session created:", checkoutSession.id);
    console.log("Checkout URL:", checkoutSession.url);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error("=== Checkout session creation error ===");
    console.error("Error message:", err.message);
    console.error("Error type:", err.type);
    console.error("Error code:", err.code);
    console.error("Full error:", err);
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
