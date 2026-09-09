// PUT /api/campaigns/[id]/pledges — Définir les engagements (montants
// personnalisés « Option B » : l'admin coche les membres et leur dû)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const campaign = await db.contributionCampaign.findUnique({ where: { id } });
    if (!campaign) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

    const pledges: { memberId: string; amountDue: number }[] = (Array.isArray(body.pledges) ? body.pledges : [])
      .map((p: any) => ({ memberId: String(p.memberId), amountDue: Number(p.amountDue) || 0 }))
      .filter((p) => p.memberId);

    // Remplace tous les engagements de la campagne
    await db.contributionPledge.deleteMany({ where: { campaignId: id } });
    if (pledges.length > 0) {
      await db.contributionPledge.createMany({ data: pledges.map((p) => ({ ...p, campaignId: id })) });
    }
    await db.contributionCampaign.update({ where: { id }, data: { allowCustom: true } });

    await audit(admin.id, "UPDATE", "Campaign", id, `Répartition personnalisée : ${pledges.length} membres engagés sur « ${campaign.name} »`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
