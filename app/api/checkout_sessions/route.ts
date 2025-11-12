import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { pool } from "@/lib/auth";

export async function POST() {
  try {
    // Get authenticated user session
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user's Twitter account ID
    const result = await pool.query(
      'SELECT * FROM account WHERE "userId" = $1 AND "providerId" = $2',
      [session.user.id, "twitter"]
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: "Twitter account not found" },
        { status: 404 }
      );
    }

    const twitterId = result.rows[0].accountId;

    const origin = headersList.get("origin") || process.env.BETTER_AUTH_URL || "http://localhost:3000";

    // Create Checkout Session with user metadata
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
      automatic_tax: { enabled: true },
      metadata: {
        userId: session.user.id,
        twitterId: twitterId,
      },
      customer_email: session.user.email || undefined,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error("Checkout session creation error:", err);
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
