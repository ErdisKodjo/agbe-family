// PATCH /api/members/[id] — Modifier la fiche membre (admin)
// DELETE /api/members/[id] — Désactiver/supprimer un membre (admin)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, hashPassword, normalizePhone, isValidPhone } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { DEFAULT_PASSWORD } from "@/lib/constants";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const existing = await db.member.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

    const data: any = {};
    if (body.firstName != null) data.firstName = String(body.firstName).trim();
    if (body.lastName != null) data.lastName = String(body.lastName).trim();
    if (body.city !== undefined) data.city = body.city ? String(body.city).trim() : null;
    if (body.position !== undefined) data.position = body.position ? String(body.position).trim() : null;
    if (body.role != null) data.role = String(body.role);
    if (body.registryId != null) {
      const reg = await db.registry.findFirst({ where: { id: String(body.registryId), isGlobal: false } });
      if (!reg) return NextResponse.json({ error: "Registre invalide" }, { status: 400 });
      data.registryId = reg.id;
    }
    if (body.phone != null) {
      const phone = normalizePhone(String(body.phone));
      if (!isValidPhone(phone)) {
        return NextResponse.json({ error: "Numéro de téléphone invalide (format international)" }, { status: 400 });
      }
      const dup = await db.member.findFirst({ where: { phone, NOT: { id } } });
      if (dup) return NextResponse.json({ error: "Ce numéro est déjà utilisé" }, { status: 409 });
      data.phone = phone;
    }
    if (body.resetPassword) {
      data.passwordHash = hashPassword(body.password ? String(body.password) : DEFAULT_PASSWORD);
      data.mustChangePassword = true;
    }

    const member = await db.member.update({ where: { id }, data });
    await audit(admin.id, "UPDATE", "Member", id, `Modification de la fiche de ${member.firstName} ${member.lastName}`);
    return NextResponse.json({ member: { ...member, passwordHash: undefined } });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const existing = await db.member.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    if (id === admin.id) {
      return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });
    }

    // Désactivation douce : conserve la traçabilité financière
    await db.member.update({
      where: { id },
      data: { isActive: false },
    });
    await db.session.deleteMany({ where: { memberId: id } });
    await audit(admin.id, "DELETE", "Member", id, `Retrait du membre ${existing.firstName} ${existing.lastName}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
