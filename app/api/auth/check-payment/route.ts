import { NextResponse } from "next/server";
import { auth, pool } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Check if the authenticated user has completed payment
 */
export async function GET() {
  try {
    // Get authenticated user session
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return NextResponse.json(
        { hasPaid: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if payment exists for this user
    const result = await pool.query(
      `SELECT id, stripe_payment_status, amount, currency, created_at
       FROM payment
       WHERE user_id = $1 AND stripe_payment_status = 'paid'`,
      [session.user.id]
    );

    const hasPaid = result.rows.length > 0;

    return NextResponse.json({
      hasPaid,
      payment: hasPaid ? result.rows[0] : null,
    });
  } catch (error: any) {
    console.error("Check payment error:", error);
    return NextResponse.json(
      { hasPaid: false, error: error.message },
      { status: 500 }
    );
  }
}
