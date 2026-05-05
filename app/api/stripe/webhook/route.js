// app/api/stripe/webhook/route.js
// Handles Stripe events to update user plan in Clerk metadata
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const clerk = await clerkClient();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const clerkUserId = session.metadata?.clerk_user_id;
      if (clerkUserId) {
        const user = await clerk.users.getUser(clerkUserId);
        const meta = user.publicMetadata || {};
        await clerk.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...meta,
            plan: "paid",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            subscribedAt: new Date().toISOString(),
          },
        });
        console.log(`User ${clerkUserId} upgraded to paid plan.`);
      }
    }

    if (
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.paused"
    ) {
      const subscription = event.data.object;
      // Find user by stripeCustomerId in Clerk metadata
      // We store stripeCustomerId in publicMetadata at checkout
      const customerId = subscription.customer;
      // Search users by metadata (Clerk doesn't support direct metadata search,
      // so we use the subscription metadata if available)
      const clerkUserId = subscription.metadata?.clerk_user_id;
      if (clerkUserId) {
        const user = await clerk.users.getUser(clerkUserId);
        const meta = user.publicMetadata || {};
        if (meta.plan === "paid") {
          await clerk.users.updateUserMetadata(clerkUserId, {
            publicMetadata: {
              ...meta,
              plan: "free_trial",
              canceledAt: new Date().toISOString(),
            },
          });
          console.log(`User ${clerkUserId} subscription canceled, reverted to free_trial.`);
        }
      }
    }
  } catch (err) {
    console.error("Error processing webhook event:", err);
    return new Response("Internal error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
