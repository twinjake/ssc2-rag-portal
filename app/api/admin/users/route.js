// app/api/admin/users/route.js
import { clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const SESSION_TOKEN = "ssc_admin_session";
const VALID_TOKEN = process.env.ADMIN_SESSION_SECRET || "ssc_admin_secret_2024_xK9mP3";

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN)?.value;
  return token === VALID_TOKEN;
}

// GET — list all users with plan and usage info
export async function GET() {
  if (!(await checkAdminAuth())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const clerk = await clerkClient();
    const response = await clerk.users.getUserList({ limit: 500 });
    const userList = response.data || response;

    const users = userList.map((u) => {
      const meta = u.publicMetadata || {};
      const email =
        u.emailAddresses?.[0]?.emailAddress || "";
      const name =
        [u.firstName, u.lastName].filter(Boolean).join(" ") || "";
      return {
        id: u.id,
        name,
        email,
        plan: meta.plan || "free_trial",
        chatCount: Number(meta.chatCount) || 0,
        lastChat: meta.lastChat || null,
        createdAt: u.createdAt,
      };
    });

    // Sort by most recently active
    users.sort((a, b) => {
      const aTime = a.lastChat ? new Date(a.lastChat).getTime() : a.createdAt || 0;
      const bTime = b.lastChat ? new Date(b.lastChat).getTime() : b.createdAt || 0;
      return bTime - aTime;
    });

    return Response.json({ users });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}

// POST — update a user's plan
export async function POST(req) {
  if (!(await checkAdminAuth())) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { userId, plan } = await req.json();

    if (!userId || !["paid", "free_trial", "comped"].includes(plan)) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const meta = user.publicMetadata || {};

    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...meta,
        plan,
        // If resetting to free_trial, also reset chat count
        ...(plan === "free_trial" ? { chatCount: 0 } : {}),
      },
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Server error." }, { status: 500 });
  }
}
