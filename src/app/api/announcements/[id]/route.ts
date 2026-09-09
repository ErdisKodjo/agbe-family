// DELETE /api/announcements/[id] — Supprimer une annonce
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const existing = await db.announcement.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    await db.announcement.delete({ where: { id } });
    await audit(admin.id, "DELETE", "Announcement", id, `Suppression de l'annonce « ${existing.title} »`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
