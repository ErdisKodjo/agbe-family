// POST /api/auth/login — Connexion (téléphone + mot de passe)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, normalizePhone, createSession, setSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = normalizePhone(String(body.phone || ""));
    const password = String(body.password || "");
    if (!phone || !password) {
      return NextResponse.json({ error: "Téléphone et mot de passe requis" }, { status: 400 });
    }
    const member = await db.member.findUnique({ where: { phone }, include: { registry: true } });
    if (!member || !verifyPassword(password, member.passwordHash)) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }
    if (!member.isActive) {
      return NextResponse.json({ error: "Compte désactivé. Contactez votre tête de liste." }, { status: 403 });
    }
    const token = await createSession(member.id);
    await setSessionCookie(token);
    await audit(member.id, "LOGIN", "Member", member.id, `Connexion de ${member.firstName} ${member.lastName}`);
    return NextResponse.json({
      member: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        phone: member.phone,
        role: member.role,
        registryId: member.registryId,
        registryName: member.registry.name,
        mustChangePassword: member.mustChangePassword,
        city: member.city,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
