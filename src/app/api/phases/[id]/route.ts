// PATCH /api/phases/[id] — Avancement d'une phase (WBS)
// DELETE /api/phases/[id] — Supprimer une phase
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const existing = await db.projectPhase.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Phase introuvable" }, { status: 404 });

    const data: any = {};
    if (body.name != null) data.name = String(body.name).trim();
    if (body.progress != null) data.progress = Math.min(100, Math.max(0, Number(body.progress)));
    if (body.budget !== undefined) data.budget = body.budget ? Number(body.budget) : null;
    if (body.status != null) data.status = String(body.status);
    if (data.progress != null) data.status = data.progress >= 100 ? "DONE" : data.progress > 0 ? "IN_PROGRESS" : "PENDING";

    const phase = await db.projectPhase.update({ where: { id }, data });
    await audit(admin.id, "UPDATE", "ProjectPhase", id, `Phase « ${phase.name} » → ${phase.progress}%`);
    return NextResponse.json({ phase });
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
    const existing = await db.projectPhase.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Phase introuvable" }, { status: 404 });
    await db.projectPhase.delete({ where: { id } });
    await audit(admin.id, "DELETE", "ProjectPhase", id, `Suppression de la phase « ${existing.name} »`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
