import { NextRequest, NextResponse } from "next/server";
import { tryAdminAuth } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const record = await prisma.userCredit.findUnique({ where: { userId: params.id } });
    return NextResponse.json({ credits: record?.credits ?? 0 });
  } catch (err) {
    console.error("[admin/credits GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await tryAdminAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { credits } = await req.json();
    if (typeof credits !== "number" || credits < 0) {
      return NextResponse.json({ error: "credits must be a non-negative number" }, { status: 400 });
    }

    const record = await prisma.userCredit.upsert({
      where: { userId: params.id },
      update: { credits },
      create: { userId: params.id, credits },
    });

    return NextResponse.json({ credits: record.credits });
  } catch (err) {
    console.error("[admin/credits PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
