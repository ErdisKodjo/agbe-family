// PATCH /api/campaigns/[id] — Modifier / fermer une campagne
// DELETE /api/campaigns/[id] — Supprimer
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const existing = await db.contributionCampaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

    const data: any = {};
    if (body.name != null) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
    if (body.status != null) data.status = String(body.status);
    if (body.amount != null) data.amount = Number(body.amount);
    if (body.dueDay != null) data.dueDay = Math.min(28, Math.max(1, Number(body.dueDay)));
    if (body.targetAmount != null) data.targetAmount = Number(body.targetAmount);

    const campaign = await db.contributionCampaign.update({ where: { id }, data });
    await audit(admin.id, "UPDATE", "Campaign", id, `Modification de la campagne « ${campaign.name} »`);
    return NextResponse.json({ campaign });
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
    const existing = await db.contributionCampaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
    await db.contributionCampaign.delete({ where: { id } });
    await audit(admin.id, "DELETE", "Campaign", id, `Suppression de la campagne « ${existing.name} »`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
