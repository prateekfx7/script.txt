import { NextRequest, NextResponse } from "next/server";
import { tryAdminAuth } from "@/lib/adminGuard";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

    const allUsers = data?.users ?? [];

    // 1. Active subscribers
    const subscribers = allUsers
      .filter((u) => u.user_metadata?.subscription?.status === "active")
      .map((u) => ({
        id: u.id,
        email: u.email,
        plan: u.user_metadata?.subscription?.plan ?? "unknown",
        status: u.user_metadata?.subscription?.status ?? "inactive",
        amount: u.user_metadata?.subscription?.amount ?? 0,
        utr: u.user_metadata?.subscription?.utr ?? null,
        renewalDate: u.user_metadata?.subscription?.renewalDate ?? null,
        activatedAt: u.user_metadata?.subscription?.activatedAt ?? null,
      }));

    // 2. Pending & Review UPI Submissions
    const pendingSubmissions = allUsers
      .filter(
        (u) =>
          u.user_metadata?.subscription?.status === "pending_review" ||
          u.user_metadata?.subscription?.status === "rejected"
      )
      .map((u) => ({
        id: u.id,
        email: u.email,
        plan: u.user_metadata?.subscription?.plan ?? "pro",
        status: u.user_metadata?.subscription?.status ?? "pending_review",
        amount: u.user_metadata?.subscription?.amount ?? 500,
        utr: u.user_metadata?.subscription?.utr ?? "—",
        submittedAt: u.user_metadata?.subscription?.submittedAt ?? null,
      }));

    return NextResponse.json({
      subscribers,
      pendingSubmissions,
      total: subscribers.length,
      pendingCount: pendingSubmissions.filter((p) => p.status === "pending_review").length,
    });
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
    if (action === "grant" || action === "approve") {
      const renewalDate = new Date();
      renewalDate.setMonth(renewalDate.getMonth() + 1);
      updatedSub = {
        ...existingSub,
        status: "active",
        plan: existingSub.plan || "pro",
        amount: existingSub.amount ?? 500,
        activatedAt: new Date().toISOString(),
        renewalDate: renewalDate.toISOString(),
        reviewedByAdmin: true,
      };
    } else if (action === "reject") {
      updatedSub = {
        ...existingSub,
        status: "rejected",
        rejectedAt: new Date().toISOString(),
        reviewedByAdmin: true,
      };
    } else if (action === "revoke") {
      updatedSub = {
        ...existingSub,
        status: "revoked",
        revokedAt: new Date().toISOString(),
        reviewedByAdmin: true,
      };
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { ...existingMeta, subscription: updatedSub },
    });
    if (error) throw error;

    return NextResponse.json({ success: true, subscription: updatedSub });
  } catch (err) {
    console.error("[admin/subscriptions PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
