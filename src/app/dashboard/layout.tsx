"use client";

import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg">
      {/* Dashboard Navbar */}
      <div className="max-w-[1080px] mx-auto px-8">
        <nav className="flex items-center justify-between py-6">
          <Link href="/" className="font-pixel text-[24px] text-indigo leading-none select-none hover:opacity-80 transition-opacity">
            scribe.txt
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[14px] text-text-gray hover:text-ink font-pt-narrow font-bold transition-colors">
              ← Home
            </Link>
            <div className="bg-green-50 border border-green-300 rounded-full px-3 py-1 text-[12px] text-green-800 font-pt-narrow font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              {user.email}
            </div>
          </div>
        </nav>
      </div>
      <div className="max-w-[1080px] mx-auto px-8 pb-20">
        {children}
      </div>
    </div>
  );
}
