"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

const NAV = [
  { href: "/admin/overview",      label: "Overview" },
  { href: "/admin/users",         label: "Users" },
  { href: "/admin/jobs",          label: "Jobs" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/health",        label: "Health" },
  { href: "/admin/flags",         label: "Flags" },
];

export default function AdminNavbar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center px-10 h-[52px] font-sfpro">
      {/* Logo */}
      <Link
        href="/admin/overview"
        className="font-pixel text-[16px] font-bold text-ink tracking-tight mr-8 shrink-0 no-underline"
      >
        scribe.txt
        <span className="ml-1.5 text-[10px] font-bold text-indigo tracking-widest uppercase font-sfpro">
          admin
        </span>
      </Link>

      {/* Nav links */}
      <nav className="flex flex-1 h-full">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 h-full flex items-center text-[13px] border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "font-bold text-ink border-indigo"
                  : "font-medium text-text-gray-2 border-transparent hover:text-ink hover:border-gray-300"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-[12px] text-text-gray-2 font-mono bg-gray-100 px-2 py-1 rounded-md">
          {user?.email}
        </span>
        <button
          onClick={signOut}
          className="text-[12px] font-medium text-text-gray-2 hover:text-ink transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
