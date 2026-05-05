// app/api/admin/auth/route.js
// Handles admin login (POST), session check (GET), and logout (DELETE)
import { cookies } from "next/headers";

export const runtime = "nodejs";

const ADMIN_EMAIL = "Jake@morningdove.com";
const ADMIN_PASSWORD = "SSC95982!";
const SESSION_TOKEN = "ssc_admin_session";
// A fixed secret token — in production you'd use a random value from env
const VALID_TOKEN = process.env.ADMIN_SESSION_SECRET || "ssc_admin_secret_2024_xK9mP3";

// GET — check if admin session cookie is valid
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN)?.value;

  if (token === VALID_TOKEN) {
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false, error: "Not authenticated." }, { status: 401 });
}

// POST — validate credentials and set session cookie
export async function POST(req) {
  try {
    const { email, password } = await req.json();

    const emailMatch = (email || "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const passMatch = (password || "") === ADMIN_PASSWORD;

    if (!emailMatch || !passMatch) {
      return Response.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
    }

    // Set a secure HTTP-only session cookie (7 days)
    const cookieStore = await cookies();
    cookieStore.set(SESSION_TOKEN, VALID_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}

// DELETE — clear session cookie (logout)
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_TOKEN);
  return Response.json({ ok: true });
}
