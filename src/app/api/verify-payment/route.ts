import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const keySecret = (
      process.env.RAZORPAY_KEY_SECRET ||
      "wjQIOJjpwzh9NUvDVYvSJYtM"
    ).trim();

    const body = await req.json().catch(() => ({}));
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
      upi_utr,
      payment_method,
      user_email,
      amount,
    } = body;

    // ── 1. DIRECT UPI / UTR MANUAL REVIEW SUBMISSION ──
    if (upi_utr !== undefined || payment_method === "upi") {
      const rawUtr = String(upi_utr || "").trim();
      const cleanUtr = rawUtr.replace(/[^a-zA-Z0-9]/g, "");

      // Validation: Indian Banking UTR numbers are 12 digits (or 8-18 chars)
      if (!cleanUtr || cleanUtr.length < 8 || cleanUtr.length > 22) {
        return NextResponse.json(
          {
            error:
              "Please enter a valid 12-digit UPI Reference / UTR Number found in your payment app receipt.",
          },
          { status: 400 }
        );
      }

      const planType = plan || "pro";
      const planAmount = amount || (planType === "team" ? 1000 : 500);

      // If user email is passed, record the submission in Supabase user metadata
      if (user_email) {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        const targetUser = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === user_email.toLowerCase()
        );

        if (targetUser) {
          const existingMeta = targetUser.user_metadata ?? {};
          const renewalDate = new Date();
          renewalDate.setMonth(renewalDate.getMonth() + 1);

          await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
            user_metadata: {
              ...existingMeta,
              subscription: {
                status: "pending_review",
                plan: planType,
                amount: planAmount,
                utr: cleanUtr,
                submittedAt: new Date().toISOString(),
                renewalDate: renewalDate.toISOString(),
              },
            },
          });
        }
      }

      // DO NOT automatically activate access on raw UTR!
      return NextResponse.json({
        verified: false,
        status: "pending_review",
        message:
          "Payment reference submitted successfully. Pro access will be activated once verified by admin.",
        paymentId: `UPI_UTR_${cleanUtr}`,
        utr: cleanUtr,
        plan: planType,
      });
    }

    // ── 2. TEST ORDER FALLBACK ──
    if (razorpay_order_id?.startsWith("order_test_")) {
      return NextResponse.json({
        verified: true,
        status: "active",
        message: "Test payment verified successfully",
        paymentId: razorpay_payment_id || `pay_test_${Date.now()}`,
        orderId: razorpay_order_id,
        plan: plan || "pro",
      });
    }

    // ── 3. AUTOMATED RAZORPAY GATEWAY SIGNATURE VERIFICATION ──
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required payment verification parameters" },
        { status: 400 }
      );
    }

    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(text)
      .digest("hex");

    const isVerified = expectedSignature === razorpay_signature;

    if (!isVerified) {
      console.warn("Payment signature mismatch for order:", razorpay_order_id);
      return NextResponse.json(
        { verified: false, error: "Payment verification failed: Signature mismatch" },
        { status: 400 }
      );
    }

    // If verified via Gateway, activate user subscription
    if (user_email) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      const targetUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === user_email.toLowerCase()
      );

      if (targetUser) {
        const existingMeta = targetUser.user_metadata ?? {};
        const renewalDate = new Date();
        renewalDate.setMonth(renewalDate.getMonth() + 1);

        await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
          user_metadata: {
            ...existingMeta,
            subscription: {
              status: "active",
              plan: plan || "pro",
              amount: plan === "team" ? 1000 : 500,
              paymentId: razorpay_payment_id,
              activatedAt: new Date().toISOString(),
              renewalDate: renewalDate.toISOString(),
            },
          },
        });
      }
    }

    return NextResponse.json({
      verified: true,
      status: "active",
      message: "Payment verified successfully",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      plan: plan || "pro",
    });
  } catch (err: unknown) {
    console.error("Error verifying payment signature:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to verify payment" },
      { status: 500 }
    );
  }
}
