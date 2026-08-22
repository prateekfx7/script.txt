"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

const Checkmark = () => (
  <svg
    className="w-[15px] h-[15px] flex-shrink-0 text-indigo"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6L9 17l-5-5" />
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
    const el = document.getElementById("hero-dropzone");
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
    <section className="section-pad relative font-pt-narrow" id="pricing">
      <div className="section-head text-center mb-10 max-w-[640px] mx-auto">
        <p className="text-indigo font-bold text-[14px] uppercase tracking-wider mb-2">Pricing</p>
        <h2
          className="font-pt-narrow font-bold text-ink leading-tight"
          style={{ fontSize: "clamp(28px, 4vw, 40px)" }}
        >
          Simple, transparent plans
        </h2>
        <p className="font-pt-narrow text-text-gray text-[17px] max-w-[48ch] mx-auto mt-2 font-medium">
          7 free transcripts every day. Upgrade when you need unlimited power and cloud AI.
        </p>

        {/* Minimal Billing Toggle */}
        <div className="inline-flex p-1 bg-[#ECECEA]/70 border border-ink/10 rounded-full mt-6 gap-1 shadow-inner">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition-all cursor-pointer ${
              billingCycle === "monthly"
                ? "bg-white text-ink shadow-sm"
                : "text-text-gray hover:text-ink font-medium"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              billingCycle === "yearly"
                ? "bg-white text-ink shadow-sm"
                : "text-text-gray hover:text-ink font-medium"
            }`}
          >
            Yearly <span className="text-[11px] text-indigo font-bold bg-indigo/10 px-2 py-0.5 rounded-full">Save 20%</span>
          </button>
        </div>

        {/* Logged in status */}
        {!authLoading && user && (
          <div className="mt-4 inline-flex items-center justify-center gap-2 text-[13px] text-text-gray font-medium">
            <span>Signed in as <strong>{user.user_metadata?.username || user.email}</strong></span>
            {isSubscriber && (
              <span className="bg-indigo/10 text-indigo font-bold px-2.5 py-0.5 rounded-full text-[11.5px]">
                Active Pro
              </span>
            )}
            {isPendingReview && (
              <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full text-[11.5px]">
                Review Pending
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch max-w-[1020px] mx-auto px-4">
        {/* FREE PLAN */}
        <div className="bg-white border border-ink/15 rounded-[20px] p-7 flex flex-col relative shadow-sm hover:shadow-md transition-all">
          <div className="font-pt-narrow font-bold text-[20px] text-ink mb-1">Free Daily</div>
          <div className="font-pt-narrow text-[14.5px] text-text-gray mb-4 font-medium">
            For casual creators and short video clips.
          </div>

          <div className="flex items-baseline gap-1 mb-5">
            <span className="font-sf-pro font-bold text-[42px] text-ink leading-none tracking-tight">
              ₹0
            </span>
            <span className="font-pt-narrow text-[14px] text-text-gray font-medium">/ forever</span>
          </div>

          <ul className="flex flex-col gap-3 mb-8 flex-grow font-pt-narrow text-[15px] text-ink font-medium">
            <li className="flex items-center gap-2.5">
              <Checkmark /> 7 free transcripts daily
            </li>
            <li className="flex items-center gap-2.5">
              <Checkmark /> Groq Whisper Cloud AI
            </li>
            <li className="flex items-center gap-2.5">
              <Checkmark /> Instant YouTube captions
            </li>
            <li className="flex items-center gap-2.5">
              <Checkmark /> TXT, SRT & VTT exports
            </li>
          </ul>

          <button
            id="plan-free-btn"
            onClick={handleFreePlanClick}
            className="w-full py-3 text-[15.5px] font-pt-narrow font-bold text-ink bg-gray-100 hover:bg-gray-200 rounded-[12px] cursor-pointer transition-all border border-gray-200/60"
          >
            Start Free
          </button>
        </div>

        {/* PRO PLAN */}
        <div className="bg-white border-2 border-indigo rounded-[20px] p-7 flex flex-col relative shadow-md hover:shadow-lg transition-all">
          <div className="absolute -top-3 right-6 bg-indigo text-white font-pt-narrow font-bold text-[11.5px] px-3 py-0.5 rounded-full uppercase tracking-wide">
            Popular
          </div>

          <div className="font-pt-narrow font-bold text-[20px] text-ink mb-1">Pro Unlimited</div>
          <div className="font-pt-narrow text-[14.5px] text-text-gray mb-4 font-medium">
            For creators, editors, and daily power users.
          </div>

          <div className="flex items-baseline gap-1 mb-5">
            <span className="font-sf-pro font-bold text-[42px] text-indigo leading-none tracking-tight">
              ₹{proPriceDisplay}
            </span>
            <span className="font-pt-narrow text-[14px] text-text-gray font-medium">/ month</span>
          </div>

          <ul className="flex flex-col gap-3 mb-8 flex-grow font-pt-narrow text-[15px] text-ink font-medium">
            <li className="flex items-center gap-2.5 font-bold text-indigo">
              <Checkmark /> Unlimited transcripts daily
            </li>
            <li className="flex items-center gap-2.5 font-bold text-indigo">
              <Checkmark /> Fast Groq Whisper Cloud AI
            </li>
            <li className="flex items-center gap-2.5">
              <Checkmark /> Instagram Reel & YouTube extraction
            </li>
            <li className="flex items-center gap-2.5">
              <Checkmark /> Priority processing queue
            </li>
            <li className="flex items-center gap-2.5">
              <Checkmark /> Pay via UPI (GPay, PhonePe, Paytm, QR)
            </li>
          </ul>

          <button
            id="plan-pro-btn"
            onClick={() => handleOpenCheckout("pro")}
            className="w-full py-3 text-[15.5px] font-pt-narrow font-bold text-white bg-indigo hover:bg-indigo/90 rounded-[12px] cursor-pointer transition-all shadow-sm active:scale-[0.99] border border-indigo/20"
          >
            {!authLoading && !user
              ? "Login to Subscribe"
              : isSubscriber
              ? "Current Plan"
              : "Upgrade to Pro"}
          </button>
        </div>

        {/* TEAM PLAN */}
        <div className="bg-white border border-ink/15 rounded-[20px] p-7 flex flex-col relative shadow-sm hover:shadow-md transition-all">
          <div className="font-pt-narrow font-bold text-[20px] text-ink mb-1">Team Workspace</div>
          <div className="font-pt-narrow text-[14.5px] text-text-gray mb-4 font-medium">
            For production teams and agencies.
          </div>

          <div className="flex items-baseline gap-1 mb-5">
            <span className="font-sf-pro font-bold text-[42px] text-ink leading-none tracking-tight">
              ₹{teamPriceDisplay}
            </span>
            <span className="font-pt-narrow text-[14px] text-text-gray font-medium">/ month</span>
          </div>

          <ul className="flex flex-col gap-3 mb-8 flex-grow font-pt-narrow text-[15px] text-ink font-medium">
            <li className="flex items-center gap-2.5">
              <Checkmark /> Shared team workspace
            </li>
            <li className="flex items-center gap-2.5">
              <Checkmark /> Unlimited transcriptions
            </li>
            <li className="flex items-center gap-2.5">
              <Checkmark /> Groq Whisper Cloud AI
            </li>
            <li className="flex items-center gap-2.5">
              <Checkmark /> Dedicated VIP support
            </li>
          </ul>

          <button
            id="plan-team-btn"
            onClick={() => handleOpenCheckout("team")}
            className="w-full py-3 text-[15.5px] font-pt-narrow font-bold text-ink bg-gray-100 hover:bg-gray-200 rounded-[12px] cursor-pointer transition-all border border-gray-200/60"
          >
            {!authLoading && !user ? "Login to Subscribe" : "Get Team Plan"}
          </button>
        </div>
      </div>

      {/* Minimal UPI Payment Modal */}
      {upiModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-pt-narrow">
          <div className="bg-white border border-ink/20 rounded-[20px] p-6 sm:p-7 max-w-md w-full text-left shadow-lg relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setUpiModal(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-text-gray hover:text-ink hover:bg-gray-200 transition-colors cursor-pointer text-sm"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="mb-5">
              <h3 className="font-pt-narrow font-bold text-[22px] text-ink leading-tight">
                {upiModal.plan.toUpperCase()} Plan Subscription
              </h3>
              <p className="font-pt-narrow text-[14px] text-text-gray mt-0.5 font-medium">
                Amount: <strong className="font-sf-pro font-bold text-indigo text-[19px]">₹{upiModal.amount}</strong> ({billingCycle})
              </p>
            </div>

            {/* QR & UPI ID */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50/80 p-4 border border-gray-200 rounded-[14px] mb-5">
              <div className="w-[130px] h-[130px] bg-white border border-gray-200 rounded-[10px] p-2 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={upiQrCodeUrl} alt="UPI QR Code" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-pt-narrow font-bold text-[15px] text-ink mb-1">Scan QR or Copy UPI ID</p>
                <p className="font-pt-narrow text-[12.5px] text-text-gray mb-2 font-medium">
                  Use GPay, PhonePe, Paytm, BHIM, or any banking app.
                </p>
                <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-[8px] p-1.5 px-2 text-xs">
                  <span className="font-sf-pro font-semibold text-ink text-[13px]">{UPI_ID}</span>
                  <button
                    onClick={handleCopyUpiId}
                    className="bg-indigo text-white px-2 py-0.5 rounded-[6px] text-[11px] font-pt-narrow font-bold hover:bg-indigo/90 transition-colors cursor-pointer"
                  >
                    {copiedUpi ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            {/* Direct UPI App Links */}
            <div className="mb-5">
              <label className="block font-pt-narrow font-bold text-[13.5px] text-text-gray mb-1.5">
                Or open directly in app:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["GPay", "#4285F4"],
                  ["PhonePe", "#5f259f"],
                  ["Paytm", "#00baf2"],
                  ["BHIM", "#0078d4"],
                ].map(([name]) => (
                  <a
                    key={name}
                    href={upiPayUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-gray-200 bg-white py-1.5 rounded-[8px] text-center font-pt-narrow font-bold text-xs hover:bg-indigo/5 hover:border-indigo/30 transition-colors"
                  >
                    {name}
                  </a>
                ))}
              </div>
            </div>

            {/* UTR Verification */}
            <form onSubmit={handleVerifyUtr} className="pt-4 border-t border-gray-100">
              <label className="block font-pt-narrow font-bold text-[14px] text-ink mb-1">
                Enter 12-Digit UPI Reference / UTR:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 324109854321"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  className="flex-1 border border-ink/20 rounded-[10px] px-3 py-2 text-sm font-sf-pro font-medium outline-none focus:border-indigo"
                  required
                />
                <button
                  type="submit"
                  disabled={verifyingUtr}
                  className="bg-indigo hover:bg-indigo/90 text-white font-pt-narrow font-bold text-sm px-4 py-2 rounded-[10px] disabled:opacity-50 shrink-0 cursor-pointer transition-all shadow-sm"
                >
                  {verifyingUtr ? "Verifying..." : "Submit UTR"}
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
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-pt-narrow">
          <div className="bg-white border border-ink/20 rounded-[20px] p-7 max-w-md w-full text-center shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-pt-narrow font-bold text-[24px] text-ink mb-2">
              Payment Submitted for Review
            </h3>
            <p className="font-pt-narrow text-[15px] text-text-gray mb-4 font-medium leading-relaxed">
              We received your reference for the <strong className="text-indigo uppercase">{pendingSubmission.plan}</strong> plan (<span className="font-sf-pro font-bold">₹{pendingSubmission.amount}</span>).
            </p>
            <div className="bg-amber-50/80 border border-amber-200 rounded-[10px] p-3 text-xs text-amber-950 mb-5 text-left space-y-1">
              <div><strong>UTR:</strong> <span className="font-sf-pro font-medium">{pendingSubmission.utr}</span></div>
              <div><strong>Status:</strong> Pending Admin Verification</div>
            </div>
            <button
              onClick={() => setPendingSubmission(null)}
              className="w-full py-2.5 text-[15px] bg-indigo text-white hover:bg-indigo/90 rounded-[10px] font-bold cursor-pointer transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {paymentSuccess && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-pt-narrow">
          <div className="bg-white border border-ink/20 rounded-[20px] p-7 max-w-md w-full text-center shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-pt-narrow font-bold text-[24px] text-ink mb-2">Payment Successful!</h3>
            <p className="font-pt-narrow text-[15px] text-text-gray mb-4 font-medium">
              You are now subscribed to the <strong className="text-indigo uppercase">{paymentSuccess.plan}</strong> plan.
            </p>
            <button
              onClick={() => setPaymentSuccess(null)}
              className="w-full py-2.5 text-[15px] bg-indigo text-white hover:bg-indigo/90 rounded-[10px] font-bold cursor-pointer transition-all"
            >
              Start Transcribing
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
