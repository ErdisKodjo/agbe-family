// PATCH /api/registries/[id] — Modifier (nom, description, transparence, tête de liste)
// DELETE /api/registries/[id] — Supprimer le registre
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ROLES } from "@/lib/constants";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const existing = await db.registry.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Registre introuvable" }, { status: 404 });

    const data: any = {};
    if (body.name != null) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
    if (body.transparency !== undefined) data.transparency = Boolean(body.transparency);
    if (body.headMemberId !== undefined) {
      data.headMemberId = body.headMemberId ? String(body.headMemberId) : null;
      if (body.headMemberId) {
        await db.member
          .update({ where: { id: String(body.headMemberId) }, data: { role: ROLES.HEAD } })
          .catch(() => {});
      }
    }

    const registry = await db.registry.update({ where: { id }, data });
    await audit(admin.id, "UPDATE", "Registry", id, `Modification du registre « ${registry.name} »`);
    return NextResponse.json({ registry });
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
    const existing = await db.registry.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Registre introuvable" }, { status: 404 });

    await db.registry.delete({ where: { id } });
    await audit(admin.id, "DELETE", "Registry", id, `Suppression du registre « ${existing.name} »`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
