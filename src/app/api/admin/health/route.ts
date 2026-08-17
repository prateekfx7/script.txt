import { NextRequest, NextResponse } from "next/server";
import { tryAdminAuth } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;

  const results: Record<string, { ok: boolean; latencyMs: number; error?: string }> = {};

  // ── 1. Database ──────────────────────────────────────────────────────────────
  try {
    const t0 = Date.now();
    await prisma.job.count();
    results.database = { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    results.database = { ok: false, latencyMs: 0, error: String(e) };
  }

  // ── 2. Supabase Auth ─────────────────────────────────────────────────────────
  try {
    const t0 = Date.now();
    const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    results.supabase = error
      ? { ok: false, latencyMs: Date.now() - t0, error: error.message }
      : { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    results.supabase = { ok: false, latencyMs: 0, error: String(e) };
  }

  // ── 3. Inngest ───────────────────────────────────────────────────────────────
  try {
    const t0 = Date.now();
    const inngestKey = process.env.INNGEST_EVENT_KEY;
    if (inngestKey) {
      results.inngest = { ok: true, latencyMs: Date.now() - t0 };
    } else {
      const res = await fetch("http://localhost:8288/", { signal: AbortSignal.timeout(2000) });
      results.inngest = { ok: res.ok || res.status < 500, latencyMs: Date.now() - t0 };
    }
  } catch {
    results.inngest = { ok: false, latencyMs: 0, error: "Not reachable (dev server or keys not configured)" };
  }

  // ── 4. OpenAI Whisper API ───────────────────────────────────────────────────
  try {
    const t0 = Date.now();
    const apiKey = process.env.OPENAI_API_KEY ?? "";
    const baseUrl = process.env.TRANSCRIBE_API_BASE_URL ?? "https://api.openai.com/v1";
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    results.whisper = res.ok
      ? { ok: true, latencyMs: Date.now() - t0 }
      : { ok: false, latencyMs: Date.now() - t0, error: `HTTP ${res.status}` };
  } catch (e) {
    results.whisper = { ok: false, latencyMs: 0, error: String(e) };
  }

  // ── 5. flags.json ────────────────────────────────────────────────────────────
  try {
    const flagsPath = path.join(process.cwd(), "flags.json");
    fs.readFileSync(flagsPath, "utf-8");
    results.flags = { ok: true, latencyMs: 0 };
  } catch {
    results.flags = { ok: false, latencyMs: 0, error: "flags.json not found" };
  }

  return NextResponse.json({ results, checkedAt: new Date().toISOString() });
}
