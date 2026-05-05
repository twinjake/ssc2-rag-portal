// app/api/admin/users/route.js
// Admin-only endpoint: list all users with plan/usage, update user plans
import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "jacob@spencerstudyclub.com";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const email = user.emailAddresses?.[0]?.emailAddress || "";
  // Also allow users with admin plan in metadata
  const isAdmin =
    email === ADMIN_EMAIL ||
    (user.publicMetadata?.plan === "admin");
  return isAdmin ? { userId, clerk, user } : null;
}

// GET /api/admin/users — list all users
export async function GET(req) {
  const admin = await requireAdmin();
  if (!admin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { clerk } = admin;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 100), 500);
    const offset = Number(searchParams.get("offset") || 0);

    const response = await clerk.users.getUserList({ limit, offset, orderBy: "-created_at" });
    const users = response.data || response;

    const formatted = users.map((u) => {
      const meta = u.publicMetadata || {};
      return {
        id: u.id,
        email: u.emailAddresses?.[0]?.emailAddress || "",
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        plan: meta.plan || "free_trial",
        chatCount: meta.chatCount || 0,
        lastChat: meta.lastChat || null,
        subscribedAt: meta.subscribedAt || null,
        createdAt: u.createdAt,
      };
    });

    return new Response(JSON.stringify({ users: formatted, total: formatted.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}

// PATCH /api/admin/users — update a user's plan
// Body: { userId: string, plan: "free_trial" | "paid" | "comped" | "admin", resetCount?: boolean }
export async function PATCH(req) {
  const admin = await requireAdmin();
  if (!admin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { clerk } = admin;
    const body = await req.json();
    const { userId: targetId, plan, resetCount } = body;

    if (!targetId || !plan) {
      return new Response(JSON.stringify({ error: "userId and plan are required" }), { status: 400 });
    }

    const validPlans = ["free_trial", "paid", "comped", "admin"];
    if (!validPlans.includes(plan)) {
      return new Response(JSON.stringify({ error: `plan must be one of: ${validPlans.join(", ")}` }), { status: 400 });
    }

    const targetUser = await clerk.users.getUser(targetId);
    const meta = targetUser.publicMetadata || {};

    const updatedMeta = {
      ...meta,
      plan,
      updatedAt: new Date().toISOString(),
      updatedBy: admin.userId,
    };

    if (resetCount) {
      updatedMeta.chatCount = 0;
    }

    await clerk.users.updateUserMetadata(targetId, { publicMetadata: updatedMeta });

    return new Response(JSON.stringify({ success: true, userId: targetId, plan }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}

// POST /api/admin/users — invite/create a new user by email
// Body: { email: string, firstName?: string, lastName?: string, plan?: string }
export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { clerk } = admin;
    const body = await req.json();
    const { email, firstName, lastName, plan = "free_trial" } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), { status: 400 });
    }

    // Create invitation via Clerk
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        plan,
        chatCount: 0,
        invitedAt: new Date().toISOString(),
        invitedBy: admin.userId,
        firstName: firstName || "",
        lastName: lastName || "",
      },
      redirectUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://www.askdrspencer.com",
    });

    return new Response(
      JSON.stringify({ success: true, invitationId: invitation.id, email }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500 });
  }
}
