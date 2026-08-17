import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — scribe.txt",
  description: "Terms of service for scribe.txt",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg font-pt-narrow">
      <nav className="max-w-[1080px] mx-auto px-8 py-6 flex items-center justify-between">
        <Link href="/" className="font-pixel text-[24px] text-indigo leading-none hover:opacity-80 transition-opacity">scribe.txt</Link>
        <Link href="/" className="text-[15px] text-text-gray hover:text-ink transition-colors">← Home</Link>
      </nav>

      <main className="max-w-[680px] mx-auto px-8 py-14">
        <p className="eyebrow">legal</p>
        <h1 className="font-bold text-[36px] text-ink leading-tight mb-4">Terms of Service</h1>
        <p className="text-[14px] text-text-gray-2 mb-10">Last updated: August 2026</p>

        {[
          {
            title: "1. Acceptance",
            body: "By using scribe.txt, you agree to these terms. If you don't agree, please don't use the service.",
          },
          {
            title: "2. What you can do",
            body: "You may use scribe.txt to transcribe videos and audio files for personal or commercial purposes. You retain ownership of all content you upload.",
          },
          {
            title: "3. What you can't do",
            body: "You may not use scribe.txt to transcribe content that violates applicable laws, including content you don't have the right to reproduce. You may not attempt to reverse-engineer, abuse, or overload the service.",
          },
          {
            title: "4. Free tier limits",
            body: "Free accounts are subject to daily usage limits. These limits may change. We reserve the right to suspend accounts that abuse the free tier.",
          },
          {
            title: "5. Subscriptions & refunds",
            body: "Paid subscriptions are billed monthly. Refunds are handled on a case-by-case basis — contact us within 7 days of a charge if you have an issue.",
          },
          {
            title: "6. Service availability",
            body: "We aim for high availability but cannot guarantee it. We are not liable for any losses caused by downtime or errors in transcription output.",
          },
          {
            title: "7. Changes to terms",
            body: "We may update these terms. Continued use of the service after changes constitutes acceptance.",
          },
          {
            title: "8. Contact",
            body: "Questions? Email prateekmaurya862@gmail.com.",
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
