"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sub = user?.user_metadata?.subscription;
  const isSubscriber = sub?.status === "active";

  const username =
    user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Account";

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
              // Logged in: Username Dropdown (no profile image)
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] hover:bg-black/5 font-pt-narrow font-bold text-[16px] text-ink cursor-pointer group transition-all"
                  id="nav-user-avatar"
                >
                  <span className="text-ink group-hover:text-indigo transition-colors font-bold">
                    {username}
                  </span>
                  {/* Chevron */}
                  <svg
                    className={`w-3.5 h-3.5 text-text-gray transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-[220px] bg-white border border-ink/20 rounded-[14px] shadow-sm overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 font-pt-narrow">
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                      <p className="font-pt-narrow font-bold text-[15px] text-ink truncate">{username}</p>
                      <p className="font-pt-narrow text-[12.5px] text-text-gray truncate">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {isSubscriber ? (
                          <span className="text-[11.5px] font-bold font-pt-narrow text-indigo bg-indigo/10 px-2 py-0.5 rounded-full">
                            Pro Member
                          </span>
                        ) : (
                          <span className="text-[11.5px] font-bold font-pt-narrow text-green-800 bg-green-100 px-2 py-0.5 rounded-full">
                            Free Plan
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <Link
                        href="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center px-4 py-2 font-pt-narrow font-bold text-[14.5px] text-ink hover:bg-indigo/5 hover:text-indigo transition-colors"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/dashboard"
                        onClick={() => { setDropdownOpen(false); }}
                        className="flex items-center px-4 py-2 font-pt-narrow font-bold text-[14.5px] text-ink hover:bg-indigo/5 hover:text-indigo transition-colors"
                      >
                        My Transcripts
                      </Link>
                      <Link
                        href="/#pricing"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center px-4 py-2 font-pt-narrow font-bold text-[14.5px] text-ink hover:bg-indigo/5 hover:text-indigo transition-colors"
                      >
                        {isSubscriber ? "Manage Plan" : "Upgrade to Pro"}
                      </Link>
                    </div>

                    {/* Sign Out */}
                    <div className="border-t border-gray-100 py-1">
                      <button
                        onClick={() => { signOut(); setDropdownOpen(false); }}
                        className="flex items-center w-full text-left px-4 py-2 font-pt-narrow font-bold text-[14.5px] text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
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
