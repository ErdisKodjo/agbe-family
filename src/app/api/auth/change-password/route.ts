// POST /api/auth/change-password — Changement de mot de passe
// (obligatoire à la première connexion)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember, hashPassword, verifyPassword, clearSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/constants";
import { audit } from "@/lib/audit";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const member = await getCurrentMember();
    if (!member) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const body = await req.json();
    const current = String(body.currentPassword || "");
    const next = String(body.newPassword || "");
    if (!verifyPassword(current, member.passwordHash)) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
    }
    if (next.length < 8) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
    }
    if (next === current) {
      return NextResponse.json({ error: "Le nouveau mot de passe doit être différent de l'ancien" }, { status: 400 });
    }
    await db.member.update({
      where: { id: member.id },
      data: { passwordHash: hashPassword(next), mustChangePassword: false },
    });
    await audit(member.id, "UPDATE", "Member", member.id, "Changement de mot de passe");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
