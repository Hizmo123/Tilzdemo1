import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// For an external uptime monitor. Deliberately unauthenticated (a monitor
// can't sign in) and deliberately minimal — no schema details, no counts, no
// error messages that could leak internals, just "is the database reachable
// right now". A 503 here means Tillz can't serve orders or payments.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
