"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

const Checkmark = () => (
  <svg
    className="w-[16px] h-[16px] flex-shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const SparkleIcon = () => (
  <svg
    className="w-[22px] h-[22px]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
  </svg>
);

export default function Pricing() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [paymentSuccess, setPaymentSuccess] = useState<{
    plan: string;
    paymentId: string;
  } | null>(null);

  const [pendingSubmission, setPendingSubmission] = useState<{
    plan: string;
    utr: string;
    amount: number;
  } | null>(null);

  // UPI Payment Modal State
  const [upiModal, setUpiModal] = useState<{
    plan: "pro" | "team";
    amount: number;
  } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrInput, setUtrInput] = useState("");
  const [verifyingUtr, setVerifyingUtr] = useState(false);
  const [utrError, setUtrError] = useState<string | null>(null);

  const proPriceNum = billingCycle === "yearly" ? 400 * 12 : 500;
  const teamPriceNum = billingCycle === "yearly" ? 800 * 12 : 1000;
  const proPriceDisplay = billingCycle === "yearly" ? "400" : "500";
  const teamPriceDisplay = billingCycle === "yearly" ? "800" : "1,000";

  const UPI_ID = "6264638602-3@ybl";

  // Auth gate: if not logged in, redirect to /login
  const handleOpenCheckout = (plan: "pro" | "team") => {
    if (!user) {
      router.push("/login");
      return;
    }
    setUtrError(null);
    setUtrInput("");
    const amount = plan === "pro" ? proPriceNum : teamPriceNum;
    setUpiModal({ plan, amount });
  };

  const handleCopyUpiId = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleVerifyUtr = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!upiModal) return;
    setUtrError(null);

    const cleanInput = utrInput.replace(/[^a-zA-Z0-9]/g, "");
    if (!cleanInput || cleanInput.length < 8 || cleanInput.length > 22) {
      setUtrError("Please enter a valid 12-digit UPI Reference / UTR Number from your payment receipt.");
      return;
    }

    setVerifyingUtr(true);
    try {
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method: "upi",
          upi_utr: cleanInput,
          plan: upiModal.plan,
          amount: upiModal.amount,
          user_email: user?.email,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.status === "pending_review") {
          setPendingSubmission({
            plan: upiModal.plan,
            utr: cleanInput,
            amount: upiModal.amount,
          });
          setUpiModal(null);
        } else if (data.verified) {
          setPaymentSuccess({
            plan: upiModal.plan,
            paymentId: data.paymentId || `UPI_UTR_${cleanInput}`,
          });
          setUpiModal(null);
        }
      } else {
        setUtrError(data.error || "Verification failed. Please check your UTR number.");
      }
    } catch (err) {
      console.error("UTR verification error:", err);
      setUtrError("Network error. Please try again.");
    } finally {
      setVerifyingUtr(false);
    }
  };

  const handleFreePlanClick = () => {
    const el = document.getElementById("product");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const upiPayUri = upiModal
    ? `upi://pay?pa=${UPI_ID}&pn=Scribe.txt&am=${upiModal.amount}&cu=INR&tn=${encodeURIComponent(
        upiModal.plan.toUpperCase() + " Subscription"
      )}`
    : "";

  const upiQrCodeUrl = upiModal
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiPayUri)}`
    : "";

  // Check subscription status
  const userSub = user?.user_metadata?.subscription;
  const isSubscriber = userSub?.status === "active";
  const isPendingReview = userSub?.status === "pending_review";

  return (
    <section className="section-pad relative" id="pricing">
      <div className="section-head text-center mb-10">
        <div className="font-pt-narrow font-bold text-[22px] text-indigo mb-2">✦ simple pricing ✦</div>
        <h2
          className="font-pt-narrow font-bold text-ink leading-[1.1]"
          style={{ fontSize: "clamp(30px, 4.5vw, 44px)" }}
        >
          transcribe 7 videos free every single day
        </h2>
        <p className="font-pt-narrow font-normal text-text-gray text-[18px] max-w-[50ch] mx-auto mt-3">
          Free daily transcriptions for your video clips. Upgrade when you need unlimited power.
        </p>

        {/* UPI Accepted Banner */}
        <div className="mt-4 inline-flex items-center gap-2 bg-indigo/10 border border-indigo/30 rounded-full px-4 py-1.5 text-indigo font-pt-narrow font-bold text-[14px]">
          <span className="bg-indigo text-white text-[11px] px-2 py-0.5 rounded-full uppercase">Instant</span>
          <span>⚡ Pay via UPI — GPay, PhonePe, Paytm, BHIM or QR Code</span>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <div className="bg-white border-2 border-ink rounded-full p-1 shadow-[2px_2px_0_#171717] inline-flex items-center gap-1 font-pt-narrow">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-1.5 rounded-full text-[15px] font-bold transition-all ${
                billingCycle === "monthly"
                  ? "bg-indigo text-white shadow-[1px_1px_0_#171717]"
                  : "text-text-gray hover:text-ink"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-1.5 rounded-full text-[15px] font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === "yearly"
                  ? "bg-indigo text-white shadow-[1px_1px_0_#171717]"
                  : "text-text-gray hover:text-ink"
              }`}
            >
              Yearly <span className="bg-[#FFE500] text-ink text-[11px] px-2 py-0.5 rounded-full font-bold">SAVE 20%</span>
            </button>
          </div>
        </div>

        {/* Logged-in user info / Subscription Status */}
        {!authLoading && user && (
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2">
            <div className="bg-green-50 border border-green-300 rounded-full px-4 py-1.5 font-pt-narrow text-[13px] text-green-800 inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Logged in as <strong>{user.email}</strong>
            </div>
            {isSubscriber && (
              <span className="bg-indigo text-white font-pt-narrow font-bold text-[12px] px-3 py-1 rounded-full uppercase">
                👑 Active {userSub?.plan} Member
              </span>
            )}
            {isPendingReview && (
              <span className="bg-amber-100 border border-amber-300 text-amber-900 font-pt-narrow font-bold text-[12px] px-3 py-1 rounded-full">
                ⏳ Payment Under Review (UTR: {userSub?.utr})
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px] items-stretch max-w-[1040px] mx-auto">
        {/* FREE TIER */}
        <div className="card-neo p-[32px] flex flex-col relative bg-white border-2 border-ink rounded-[20px] shadow-[4px_4px_0_#171717]">
          <div className="inline-block self-start bg-green-100 text-green-800 border border-green-300 font-pt-narrow font-bold text-[13px] px-2.5 py-0.5 rounded-full mb-3">
            100% FREE FOREVER
          </div>
          <div className="font-pt-narrow font-bold text-[22px] text-ink mb-1">Free Daily</div>
          <div className="flex items-baseline gap-[6px] my-2 mb-3">
            <span className="font-bold text-[48px] text-indigo leading-none flex items-baseline">
              <span style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>₹</span>0
            </span>
            <span className="font-pt-narrow text-[16px] text-text-gray">/ forever</span>
          </div>
          <div className="font-pt-narrow text-[16px] text-text-gray mb-6 leading-[1.4]">
            Perfect for casual creators, students, and short video clips.
          </div>
          <ul className="flex flex-col gap-[12px] mb-[30px] flex-grow font-pt-narrow text-[17px] text-ink">
            <li className="flex items-center gap-[10px] font-bold text-indigo">
              <Checkmark /> 7 Free Transcripts Daily
            </li>
            <li className="flex items-center gap-[10px]">
              <Checkmark /> 🔒 100% Local On-Device Whisper AI
            </li>
            <li className="flex items-center gap-[10px]">
              <Checkmark /> 100% Private (No data sent to cloud)
            </li>
            <li className="flex items-center gap-[10px]">
              <Checkmark /> TXT, SRT & VTT Exports
            </li>
          </ul>
          <button
            id="plan-free-btn"
            onClick={handleFreePlanClick}
            className="btn-neo justify-center w-full font-pt-narrow font-bold text-[18px] py-3 cursor-pointer"
          >
            Start Free
          </button>
        </div>

        {/* PRO TIER */}
        <div
          className="border-2 border-ink rounded-[20px] p-[32px] flex flex-col relative shadow-[6px_6px_0_#171717] transform lg:-translate-y-2"
          style={{ background: "#3222DD", color: "#fff" }}
        >
          <div className="absolute top-5 right-5 text-white/90">
            <SparkleIcon />
          </div>
          <div className="inline-block self-start bg-[#FFE500] text-ink font-pt-narrow font-bold text-[13px] px-3 py-1 rounded-full mb-3 shadow-[1px_1px_0_#171717]">
            ⚡ MOST POPULAR
          </div>
          <div className="font-pt-narrow font-bold text-[24px] text-white mb-1">Pro Unlimited</div>
          <div className="flex items-baseline gap-[6px] my-2 mb-3">
            <span className="font-bold text-[52px] text-white leading-none flex items-baseline">
              <span style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>₹</span>
              {proPriceDisplay}
            </span>
            <span className="font-pt-narrow text-[16px] text-white/80">/ month</span>
          </div>
          <div className="font-pt-narrow text-[16px] text-white/90 mb-6 leading-[1.4]">
            For serious podcasters, editors, and creators transcribing daily.
          </div>
          <ul className="flex flex-col gap-[12px] mb-[20px] flex-grow font-pt-narrow text-[17px] text-white">
            <li className="flex items-center gap-[10px] font-bold text-[#FFE500]">
              <Checkmark /> Unlimited Transcripts Daily
            </li>
            <li className="flex items-center gap-[10px] font-bold text-[#FFE500]">
              <Checkmark /> ⚡ 100% Private Local AI Engine
            </li>
            <li className="flex items-center gap-[10px]">
              <Checkmark /> 99%+ Accuracy & 40+ Languages
            </li>
            <li className="flex items-center gap-[10px]">
              <Checkmark /> Full TXT, SRT & VTT Exports
            </li>
          </ul>
          <div className="mb-4 text-xs font-pt-narrow bg-white/10 rounded-lg p-2 text-center text-white/90 border border-white/20">
            ⚡ Pay via <strong>UPI</strong> — GPay, PhonePe, Paytm, BHIM, QR
          </div>
          <button
            id="plan-pro-btn"
            onClick={() => handleOpenCheckout("pro")}
            className="btn-neo-white justify-center w-full font-pt-narrow font-bold text-[18px] py-3 text-indigo cursor-pointer"
          >
            {!authLoading && !user
              ? "🔒 Login to Subscribe"
              : isSubscriber
              ? "✓ Current Plan (Active)"
              : "Go Unlimited Pro"}
          </button>
        </div>

        {/* TEAM TIER */}
        <div className="card-neo p-[32px] flex flex-col relative bg-white border-2 border-ink rounded-[20px] shadow-[4px_4px_0_#171717]">
          <div className="inline-block self-start bg-purple-100 text-purple-900 border border-purple-300 font-pt-narrow font-bold text-[13px] px-2.5 py-0.5 rounded-full mb-3">
            TEAMS & AGENCIES
          </div>
          <div className="font-pt-narrow font-bold text-[22px] text-ink mb-1">Team Workspace</div>
          <div className="flex items-baseline gap-[6px] my-2 mb-3">
            <span className="font-bold text-[48px] text-indigo leading-none flex items-baseline">
              <span style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>₹</span>
              {teamPriceDisplay}
            </span>
            <span className="font-pt-narrow text-[16px] text-text-gray">/ month</span>
          </div>
          <div className="font-pt-narrow text-[16px] text-text-gray mb-6 leading-[1.4]">
            For agencies and production teams managing shared media assets.
          </div>
          <ul className="flex flex-col gap-[12px] mb-[20px] flex-grow font-pt-narrow text-[17px] text-ink">
            <li className="flex items-center gap-[10px] font-bold text-indigo">
              <Checkmark /> Shared Team Workspaces
            </li>
            <li className="flex items-center gap-[10px] font-bold text-indigo">
              <Checkmark /> ⚡ Unlimited Batch Processing
            </li>
            <li className="flex items-center gap-[10px]">
              <Checkmark /> Unlimited Transcripts Daily
            </li>
            <li className="flex items-center gap-[10px]">
              <Checkmark /> Dedicated VIP Support
            </li>
          </ul>
          <div className="mb-4 text-xs font-pt-narrow bg-indigo/5 rounded-lg p-2 text-center text-indigo border border-indigo/20">
            ⚡ Pay via <strong>UPI</strong> — GPay, PhonePe, Paytm, BHIM, QR
          </div>
          <button
            id="plan-team-btn"
            onClick={() => handleOpenCheckout("team")}
            className="btn-neo justify-center w-full font-pt-narrow font-bold text-[18px] py-3 cursor-pointer"
          >
            {!authLoading && !user ? "🔒 Login to Subscribe" : "Get Team Plan"}
          </button>
        </div>
      </div>

      {/* UPI PAYMENT MODAL */}
      {upiModal && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-ink rounded-[24px] p-6 sm:p-8 max-w-lg w-full text-left shadow-[8px_8px_0_#171717] relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setUpiModal(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full border-2 border-ink bg-gray-100 flex items-center justify-center font-bold text-ink hover:bg-gray-200 transition-colors"
            >
              ✕
            </button>

            {/* Header */}
            <div className="mb-6">
              <div className="inline-block bg-indigo text-white font-pt-narrow font-bold text-xs px-2.5 py-0.5 rounded-full uppercase mb-2">
                Pay via UPI
              </div>
              <h3 className="font-pt-narrow font-bold text-[26px] text-ink leading-tight">
                Subscribe to {upiModal.plan.toUpperCase()} Plan
              </h3>
              <p className="font-pt-narrow text-[15px] text-text-gray">
                Amount:{" "}
                <strong className="text-indigo text-[22px]">
                  <span style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>₹</span>
                  {upiModal.amount}
                </strong>{" "}
                ({billingCycle})
              </p>
              {user && (
                <p className="font-pt-narrow text-[13px] text-text-gray mt-1">
                  Account: <strong>{user.email}</strong>
                </p>
              )}
            </div>

            {/* QR + UPI ID */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 p-4 border-2 border-ink rounded-xl mb-5">
              <div className="w-[150px] h-[150px] bg-white border-2 border-ink rounded-lg p-2 flex items-center justify-center shadow-[3px_3px_0_#171717] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={upiQrCodeUrl} alt="UPI QR Code" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-pt-narrow font-bold text-[16px] text-ink mb-1">Scan with any UPI App</p>
                <p className="font-pt-narrow text-[13px] text-text-gray mb-3">
                  Google Pay, PhonePe, Paytm, BHIM, or your bank app.
                </p>
                <div className="inline-flex items-center gap-2 bg-white border border-gray-300 rounded-md p-1.5 pr-3 text-xs font-mono">
                  <span className="text-ink font-bold">{UPI_ID}</span>
                  <button
                    onClick={handleCopyUpiId}
                    className="bg-indigo text-white px-2 py-0.5 rounded text-[11px] font-pt-narrow font-bold hover:bg-indigo/90 transition-colors"
                  >
                    {copiedUpi ? "✓ Copied!" : "Copy ID"}
                  </button>
                </div>
              </div>
            </div>

            {/* Direct UPI App Links */}
            <div className="mb-5">
              <label className="block font-pt-narrow font-bold text-[14px] text-ink mb-2">
                Or open UPI app directly:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ["🟢", "GPay"],
                  ["🟣", "PhonePe"],
                  ["🔵", "Paytm"],
                  ["🟠", "BHIM"],
                ].map(([icon, name]) => (
                  <a
                    key={name}
                    href={upiPayUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-ink bg-white p-2 rounded-lg text-center font-pt-narrow font-bold text-xs hover:bg-indigo/10 transition-colors"
                  >
                    {icon} {name}
                  </a>
                ))}
              </div>
            </div>

            {/* UTR Verification */}
            <form onSubmit={handleVerifyUtr} className="pt-4 border-t border-gray-200">
              <label className="block font-pt-narrow font-bold text-[15px] text-ink mb-1">
                Enter 12-Digit UPI Reference / UTR Number:
              </label>
              <p className="font-pt-narrow text-[13px] text-text-gray mb-3">
                Found under &quot;Transaction Details&quot; in your UPI app receipt after payment.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 324109854321"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  className="flex-1 border-2 border-ink rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-indigo"
                  required
                />
                <button
                  type="submit"
                  disabled={verifyingUtr}
                  className="btn-neo bg-[#FFE500] font-pt-narrow font-bold text-sm px-4 py-2 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {verifyingUtr ? "Submitting..." : "Submit for Verification"}
                </button>
              </div>
              {utrError && (
                <p className="text-red-600 font-pt-narrow text-xs font-bold mt-2">{utrError}</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* PENDING MANUAL REVIEW MODAL */}
      {pendingSubmission && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-ink rounded-[24px] p-8 max-w-md w-full text-center shadow-[8px_8px_0_#171717] animate-in fade-in zoom-in duration-200">
            <div className="text-5xl mb-3">⏳</div>
            <h3 className="font-pt-narrow font-bold text-[28px] text-ink mb-2">
              Payment Submitted for Review
            </h3>
            <p className="font-pt-narrow text-[16px] text-text-gray mb-4 leading-relaxed">
              We received your payment reference for the{" "}
              <strong className="text-indigo uppercase">{pendingSubmission.plan}</strong> plan (₹
              {pendingSubmission.amount}).
            </p>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-[12px] p-4 text-xs font-mono text-amber-950 mb-6 text-left space-y-1">
              <div>
                <strong>UTR Reference:</strong> {pendingSubmission.utr}
              </div>
              <div>
                <strong>Status:</strong> Pending Admin Bank Verification
              </div>
              <div className="text-[11px] text-amber-800 mt-1 font-sans">
                Our admin team will cross-check your UTR with our bank account and activate your Pro plan shortly.
              </div>
            </div>
            <button
              onClick={() => setPendingSubmission(null)}
              className="btn-neo w-full justify-center py-3 text-[18px] bg-indigo text-white hover:bg-indigo/90 cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* INSTANT SUCCESS MODAL (GATEWAY/APPROVED) */}
      {paymentSuccess && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-ink rounded-[24px] p-8 max-w-md w-full text-center shadow-[8px_8px_0_#171717] animate-in fade-in zoom-in duration-200">
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="font-pt-narrow font-bold text-[28px] text-ink mb-2">Payment Successful!</h3>
            <p className="font-pt-narrow text-[17px] text-text-gray mb-4">
              You are now subscribed to the{" "}
              <strong className="text-indigo uppercase">{paymentSuccess.plan}</strong> plan.
            </p>
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-xs text-text-gray font-mono mb-6 break-all">
              Ref ID: {paymentSuccess.paymentId}
            </div>
            <button
              onClick={() => setPaymentSuccess(null)}
              className="btn-neo w-full justify-center py-3 text-[18px] bg-[#FFE500] cursor-pointer"
            >
              Start Transcribing
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
