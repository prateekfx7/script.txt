"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import AdminNavbar from "@/components/admin/AdminNavbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace("/login"); return; }

    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase());

    setIsAdmin(adminEmails.includes((user?.email ?? "").toLowerCase()));
  }, [loading, session, user, router]);

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-text-gray-2 text-[14px] font-sfpro">
        Loading…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 font-sfpro">
        <p className="text-[72px] font-bold text-ink leading-none">403</p>
        <p className="text-[15px] text-text-gray-2">Access denied — this email is not an admin.</p>
        <a href="/" className="text-[13px] text-indigo hover:underline">← Back to scribe.txt</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sfpro">
      <AdminNavbar />
      <main className="max-w-[1200px] mx-auto px-10 py-9 text-ink">
        {children}
      </main>
    </div>
  );
}
