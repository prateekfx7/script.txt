import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Extract the authenticated Supabase userId from a request's Authorization header.
 * Returns null if not authenticated.
 */
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    // Try cookie-based session for server components
    const cookieHeader = req.headers.get("cookie") || "";
    if (!cookieHeader) return null;
  }

  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
