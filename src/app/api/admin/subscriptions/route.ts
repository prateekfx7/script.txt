import { NextRequest, NextResponse } from "next/server";
import { tryAdminAuth } from "@/lib/adminGuard";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;

  try {
    // Fetch all users and check for subscription metadata
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw error;

    // We store subscription info in user_metadata (set by verify-payment route)
    const subscribers = (data?.users ?? [])
      .filter((u) => u.user_metadata?.subscription?.status === "active")
      .map((u) => ({
        id: u.id,
        email: u.email,
        plan: u.user_metadata?.subscription?.plan ?? "unknown",
        status: u.user_metadata?.subscription?.status ?? "inactive",
        amount: u.user_metadata?.subscription?.amount ?? 0,
        renewalDate: u.user_metadata?.subscription?.renewalDate ?? null,
        activatedAt: u.user_metadata?.subscription?.activatedAt ?? null,
      }));

    return NextResponse.json({ subscribers, total: subscribers.length });
  } catch (err) {
    console.error("[admin/subscriptions GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { userId, action } = await req.json();
    if (!userId || !action) {
      return NextResponse.json({ error: "userId and action required" }, { status: 400 });
    }

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const existingMeta = userData?.user?.user_metadata ?? {};
    const existingSub = existingMeta.subscription ?? {};

    let updatedSub;
    if (action === "grant") {
      const renewalDate = new Date();
      renewalDate.setMonth(renewalDate.getMonth() + 1);
      updatedSub = {
        ...existingSub,
        status: "active",
        plan: "pro",
        amount: existingSub.amount ?? 0,
        activatedAt: existingSub.activatedAt ?? new Date().toISOString(),
        renewalDate: renewalDate.toISOString(),
        overriddenByAdmin: true,
      };
    } else if (action === "revoke") {
      updatedSub = { ...existingSub, status: "revoked", overriddenByAdmin: true };
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { ...existingMeta, subscription: updatedSub },
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/subscriptions PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
