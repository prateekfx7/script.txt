import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — scribe.txt",
  description: "Privacy policy for scribe.txt",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg font-pt-narrow">
      <nav className="max-w-[1080px] mx-auto px-8 py-6 flex items-center justify-between">
        <Link href="/" className="font-pixel text-[24px] text-indigo leading-none hover:opacity-80 transition-opacity">scribe.txt</Link>
        <Link href="/" className="text-[15px] text-text-gray hover:text-ink transition-colors">← Home</Link>
      </nav>

      <main className="max-w-[680px] mx-auto px-8 py-14">
        <p className="eyebrow">legal</p>
        <h1 className="font-bold text-[36px] text-ink leading-tight mb-4">Privacy Policy</h1>
        <p className="text-[14px] text-text-gray-2 mb-10">Last updated: August 2026</p>

        {[
          {
            title: "1. What we collect",
            body: "We collect your email address when you sign up, and store metadata about the transcription jobs you run (file name, status, timestamps). We do not store your audio or video files permanently — they are processed and discarded.",
          },
          {
            title: "2. How we use your data",
            body: "Your data is used solely to provide and improve the scribe.txt service. We do not sell or share your personal data with third parties.",
          },
          {
            title: "3. Authentication",
            body: "Authentication is handled by Supabase. Your password is never stored in plaintext. You can delete your account at any time by contacting us.",
          },
          {
            title: "4. Payments",
            body: "Payment processing is handled by Razorpay. We do not store your payment card details on our servers.",
          },
          {
            title: "5. Cookies",
            body: "We use minimal cookies required for authentication sessions. We do not use tracking or advertising cookies.",
          },
          {
            title: "6. Contact",
            body: "If you have any questions about your data, email us at prateekmaurya862@gmail.com.",
          },
        ].map((s) => (
          <div key={s.title} className="mb-8">
            <h2 className="font-bold text-[18px] text-ink mb-2">{s.title}</h2>
            <p className="text-[15px] text-text-gray leading-[1.75]">{s.body}</p>
          </div>
        ))}
      </main>
    </div>
  );
}
