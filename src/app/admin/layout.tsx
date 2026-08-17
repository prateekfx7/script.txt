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
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#7A7A76", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <p style={{ fontSize: 72, fontWeight: 800, color: "#171717", lineHeight: 1 }}>403</p>
        <p style={{ fontSize: 15, color: "#7A7A76" }}>Access denied — this email is not an admin.</p>
        <a href="/" style={{ fontSize: 13, color: "#3222DD" }}>← Back to scribe.txt</a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F3" }}>
      <AdminNavbar />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 40px", fontFamily: "'PT Sans Narrow', sans-serif", color: "#171717" }}>
        {children}
      </main>
    </div>
  );
}
