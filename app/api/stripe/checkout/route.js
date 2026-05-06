// app/api/stripe/checkout/route.js
import Stripe from "stripe";
import { auth, currentUser } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export async function GET(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.redirect(`${SITE_URL}/sign-in`);
    }

    let customerEmail, clientReferenceId;
    try {
      const user = await currentUser();
      if (user) {
        clientReferenceId = user.id;
        customerEmail = user.emailAddresses?.[0]?.emailAddress;
      }
    } catch {}

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Ask Dr. Spencer – Unlimited Access",
              description: "Unlimited AI-powered Q&A from Spencer Study Club content.",
            },
            unit_amount: 999, // $9.99
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      client_reference_id: clientReferenceId || undefined,
      customer_email: customerEmail || undefined,
      success_url: `${SITE_URL}/?subscribed=1`,
      cancel_url: `${SITE_URL}/pricing`,
      metadata: {
        clerk_user_id: clientReferenceId || "",
      },
    });

    return Response.redirect(session.url, 303);
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
