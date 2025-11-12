import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
  typescript: true,
});

async function testStripe() {
  try {
    console.log("Testing Stripe configuration...\n");

    // Test 1: Check if we can connect to Stripe
    console.log("1. Testing Stripe API connection...");
    const balance = await stripe.balance.retrieve();
    console.log("✓ Connected to Stripe successfully");
    console.log(`  Available balance: ${balance.available[0]?.amount || 0} ${balance.available[0]?.currency || "usd"}\n`);

    // Test 2: Check if the Price ID is valid
    console.log("2. Testing STRIPE_PRICE_ID...");
    const priceId = process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      console.error("✗ STRIPE_PRICE_ID is not set in environment variables");
      return;
    }

    console.log(`  Price ID: ${priceId}`);

    try {
      const price = await stripe.prices.retrieve(priceId);
      console.log("✓ Price ID is valid");
      console.log(`  Product: ${price.product}`);
      console.log(`  Amount: ${price.unit_amount} ${price.currency}`);
      console.log(`  Active: ${price.active}`);

      if (!price.active) {
        console.warn("\n⚠️  WARNING: Price is not active! This will cause checkout to fail.");
      }

      // Try to retrieve the product
      if (typeof price.product === 'string') {
        const product = await stripe.products.retrieve(price.product);
        console.log(`  Product Name: ${product.name}`);
        console.log(`  Product Active: ${product.active}`);

        if (!product.active) {
          console.warn("\n⚠️  WARNING: Product is not active! This will cause checkout to fail.");
        }
      }
    } catch (err: any) {
      console.error("✗ Failed to retrieve price:", err.message);
      return;
    }

    // Test 3: Try to create a test checkout session
    console.log("\n3. Testing checkout session creation...");
    try {
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: "http://localhost:3000?success=true",
        cancel_url: "http://localhost:3000?canceled=true",
        metadata: {
          test: "true",
        },
      });
      console.log("✓ Checkout session created successfully");
      console.log(`  Session ID: ${session.id}`);
      console.log(`  URL: ${session.url}`);
    } catch (err: any) {
      console.error("✗ Failed to create checkout session:", err.message);
      if (err.type) {
        console.error(`  Error Type: ${err.type}`);
      }
      if (err.code) {
        console.error(`  Error Code: ${err.code}`);
      }
      return;
    }

    console.log("\n✓ All tests passed!");
  } catch (err: any) {
    console.error("\n✗ Error:", err.message);
    if (err.type) {
      console.error(`  Error Type: ${err.type}`);
    }
  }
}

testStripe();
