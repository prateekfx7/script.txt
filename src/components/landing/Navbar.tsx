"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export default function Navbar() {
  const { user, loading, signOut } = useAuth();

  return (
    <nav className="flex items-center justify-between py-[26px]">
      {/* Logo */}
      <Link href="/" className="font-pixel text-[28px] text-indigo leading-none select-none">
        scribe.txt
      </Link>

      {/* Nav links */}
      <div className="hidden md:flex gap-[34px] text-[15px] text-ink font-medium">
        <a href="#product" className="opacity-75 hover:opacity-100 transition-opacity duration-150">product</a>
        <a href="#how" className="opacity-75 hover:opacity-100 transition-opacity duration-150">how it works</a>
        <a href="#pricing" className="opacity-75 hover:opacity-100 transition-opacity duration-150">pricing</a>
      </div>

      {/* Auth / CTA area */}
      <div className="flex items-center gap-3">
        {!loading && (
          <>
            {user ? (
              // Logged in: show email chip + sign out
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 bg-green-50 border border-green-300 text-green-800 font-pt-narrow font-bold text-[13px] px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  {user.email?.split("@")[0]}
                </span>
                <button
                  onClick={signOut}
                  id="nav-signout-btn"
                  className="btn-neo text-[14px] px-4 py-2 opacity-80 hover:opacity-100"
                >
                  Sign out
                </button>
              </div>
            ) : (
              // Logged out: Login
              <Link
                href="/login"
                id="nav-login-btn"
                className="font-pt-narrow font-bold text-[16px] text-indigo hover:opacity-80 transition-opacity"
              >
                Log in
              </Link>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
