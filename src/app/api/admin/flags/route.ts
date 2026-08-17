import { NextRequest, NextResponse } from "next/server";
import { tryAdminAuth } from "@/lib/adminGuard";
import fs from "fs";
import path from "path";

const FLAGS_PATH = path.join(process.cwd(), "flags.json");

function readFlags(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(FLAGS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ flags: readFlags() });
}

export async function PATCH(req: NextRequest) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { key, value } = await req.json();
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

    const flags = readFlags();
    flags[key] = value;
    fs.writeFileSync(FLAGS_PATH, JSON.stringify(flags, null, 2));

    return NextResponse.json({ flags });
  } catch (err) {
    console.error("[admin/flags PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
