import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Page Not Found | scribe.txt",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F5F3",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'PT Sans Narrow', sans-serif",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-vt323), monospace",
          fontSize: 28,
          color: "#3222DD",
          textDecoration: "none",
          marginBottom: 64,
          letterSpacing: "-0.5px",
        }}
      >
        scribe.txt
      </Link>

      {/* Big 404 */}
      <div
        style={{
          fontSize: "clamp(96px, 20vw, 160px)",
          fontWeight: 800,
          color: "#171717",
          lineHeight: 1,
          marginBottom: 8,
          letterSpacing: "-4px",
        }}
      >
        404
      </div>

      {/* Divider */}
      <div
        style={{
          width: 40,
          height: 3,
          background: "#3222DD",
          borderRadius: 2,
          margin: "24px auto",
        }}
      />

      {/* Message */}
      <p
        style={{
          fontSize: "clamp(18px, 3vw, 22px)",
          color: "#5B5B58",
          maxWidth: 380,
          lineHeight: 1.6,
          marginBottom: 8,
        }}
      >
        bro this page doesn't exist 💀
      </p>
      <p style={{ fontSize: 15, color: "#7A7A76", marginBottom: 40 }}>
        you ate the url and left no crumbs fr
      </p>

      {/* CTA */}
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 24px",
          background: "#171717",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          borderRadius: 10,
          textDecoration: "none",
          border: "2px solid #171717",
          transition: "background 0.15s",
        }}
      >
        ← back to scribe.txt
      </Link>
    </div>
  );
}
