// POST /api/auth/logout — Déconnexion
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/constants";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await db.session.findUnique({ where: { token } });
    if (session) await audit(session.memberId, "LOGOUT", "Member", session.memberId, "Déconnexion");
    await db.session.deleteMany({ where: { token } });
  }
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
