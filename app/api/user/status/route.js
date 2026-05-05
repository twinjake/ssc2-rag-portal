// app/api/user/status/route.js
// Returns the current user's plan status and chat count from Clerk metadata
import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const meta = user.publicMetadata || {};

    const plan = meta.plan || "free_trial";          // free_trial | paid | comped
    const chatCount = meta.chatCount || 0;
    const FREE_LIMIT = 3;
    const canChat = plan === "paid" || plan === "comped" || chatCount < FREE_LIMIT;
    const chatsRemaining = plan === "paid" || plan === "comped"
      ? null
      : Math.max(0, FREE_LIMIT - chatCount);

    return new Response(JSON.stringify({ plan, chatCount, canChat, chatsRemaining, FREE_LIMIT }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}
