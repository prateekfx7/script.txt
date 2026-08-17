import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Call at the top of every /api/admin/* route handler.
 * Returns the authenticated admin user, or throws a NextResponse error.
 */
export async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes((data.user.email ?? "").toLowerCase())) {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return data.user;
}

/** Wraps requireAdmin and returns { user } or a { response } to return early */
export async function tryAdminAuth(req: NextRequest): Promise<
  | { ok: true; user: Awaited<ReturnType<typeof requireAdmin>> }
  | { ok: false; response: NextResponse }
> {
  try {
    const user = await requireAdmin(req);
    return { ok: true, user };
  } catch (e) {
    if (e instanceof NextResponse) return { ok: false, response: e };
    return {
      ok: false,
      response: NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    };
  }
}
