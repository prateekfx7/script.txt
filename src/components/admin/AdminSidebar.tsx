"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

const NAV = [
  { href: "/admin/overview", label: "Overview", icon: "▦" },
  { href: "/admin/users", label: "Users", icon: "◉" },
  { href: "/admin/jobs", label: "Jobs", icon: "◈" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "◆" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        background: "#fff",
        borderRight: "2px solid #171717",
        display: "flex",
        flexDirection: "column",
        padding: "28px 0 20px",
        flexShrink: 0,
      }}
    >
      {/* Logo + badge */}
      <div style={{ padding: "0 20px 28px", borderBottom: "2px solid #e5e5e5" }}>
        <Link
          href="/"
          style={{
            display: "block",
            fontFamily: "monospace",
            fontSize: 22,
            fontWeight: 700,
            color: "#171717",
            letterSpacing: "-0.5px",
          }}
        >
          scribe.txt
        </Link>
        <span
          style={{
            display: "inline-block",
            marginTop: 6,
            background: "#3222DD",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "2px 8px",
            borderRadius: 4,
            border: "1.5px solid #171717",
            boxShadow: "2px 2px 0 #171717",
          }}
        >
          Admin
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingTop: 12 }}>
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 20px",
                fontSize: 15,
                fontWeight: active ? 700 : 500,
                color: active ? "#3222DD" : "#5B5B58",
                background: active ? "#f0eeff" : "transparent",
                borderLeft: active ? "3px solid #3222DD" : "3px solid transparent",
                transition: "all 0.15s",
                textDecoration: "none",
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer — user info */}
      <div
        style={{
          padding: "16px 20px 0",
          borderTop: "2px solid #e5e5e5",
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: "#7A7A76",
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "monospace",
          }}
        >
          {user?.email}
        </p>
        <button
          onClick={signOut}
          style={{
            background: "none",
            border: "none",
            color: "#5B5B58",
            fontSize: 13,
            cursor: "pointer",
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          Sign out →
        </button>
      </div>
    </aside>
  );
}
