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
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#fff",
        borderBottom: "1px solid #e5e5e5",
        display: "flex",
        alignItems: "center",
        padding: "0 40px",
        height: 52,
        gap: 0,
      }}
    >
      {/* Logo */}
      <Link
        href="/admin/overview"
        style={{
          fontFamily: "monospace",
          fontSize: 16,
          fontWeight: 700,
          color: "#171717",
          letterSpacing: "-0.5px",
          marginRight: 32,
          flexShrink: 0,
          textDecoration: "none",
        }}
      >
        scribe.txt
        <span
          style={{
            marginLeft: 6,
            fontSize: 10,
            fontWeight: 700,
            color: "#3222DD",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "inherit",
          }}
        >
          admin
        </span>
      </Link>

      {/* Nav links */}
      <nav style={{ display: "flex", gap: 0, flex: 1 }}>
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "0 16px",
                height: 52,
                display: "flex",
                alignItems: "center",
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                color: active ? "#171717" : "#7A7A76",
                borderBottom: active ? "2px solid #3222DD" : "2px solid transparent",
                textDecoration: "none",
                transition: "color 0.12s",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: "#7A7A76", fontFamily: "monospace" }}>
          {user?.email}
        </span>
        <button
          onClick={signOut}
          style={{
            background: "none",
            border: "none",
            fontSize: 12,
            color: "#7A7A76",
            cursor: "pointer",
            fontFamily: "inherit",
            padding: 0,
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
