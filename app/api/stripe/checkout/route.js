import Stripe from "stripe";
import { auth, currentUser } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

const PRICE_MAP = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  team: process.env.STRIPE_PRICE_TEAM,
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tier = (searchParams.get("tier") || "").toLowerCase();
    const priceId = PRICE_MAP[tier];
    if (!priceId) {
      return new Response("Unknown or missing ?tier=starter|pro|team", { status: 400 });
    }

    let customerEmail, clientReferenceId;
    try {
      const { userId } = auth();
      if (userId) {
        clientReferenceId = userId;
        const u = await currentUser();
        customerEmail = u?.emailAddresses?.[0]?.emailAddress;
      }
    } catch {}

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      customer_email: customerEmail,
      client_reference_id: clientReferenceId,
      success_url: `${SITE_URL}/pricing?success=1`,
      cancel_url: `${SITE_URL}/pricing?canceled=1`,
      metadata: { tier, source: "askdrspencer.com" },
    });

    return new Response(null, { status: 303, headers: { Location: session.url } });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return new Response("Checkout error", { status: 500 });
  }
}
