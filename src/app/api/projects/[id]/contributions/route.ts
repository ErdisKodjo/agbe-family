// POST /api/projects/[id]/contributions — Enregistrer un apport au projet
// (« qui paie quoi » : numéraire ou en nature)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

    // Un membre peut déclarer son propre apport ; seuls les admins
    // peuvent enregistrer pour autrui.
    const memberId = body.memberId && (await requireAdmin()).id ? String(body.memberId) : me.id;

    const amount = Number(body.amount) || 0;
    const kind = String(body.kind || "CASH");

    const contribution = await db.projectContribution.create({
      data: {
        projectId: id,
        memberId,
        amount,
        kind,
        description: body.description ? String(body.description) : null,
        date: body.date ? new Date(body.date) : new Date(),
      },
      include: { member: { select: { firstName: true, lastName: true } } },
    });

    // Un apport en numéraire alimente aussi la trésorerie du registre
    if (kind === "CASH" && amount > 0) {
      await db.transaction.create({
        data: {
          registryId: project.registryId,
          type: "INCOME",
          date: contribution.date,
          label: `Apport projet « ${project.name} » — ${contribution.member.firstName} ${contribution.member.lastName}`,
          category: "PROJET",
          amount,
          note: `Apport #${contribution.id}`,
          recordedById: me.id,
        },
      });
    }

    await audit(
      me.id,
      "CREATE",
      "ProjectContribution",
      contribution.id,
      `Apport de ${amount} FCFA (${kind === "CASH" ? "numéraire" : "nature"}) — projet « ${project.name} »`
    );
    return NextResponse.json({ contribution });
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
    const { searchParams } = new URL(req.url);
    const contributionId = searchParams.get("contributionId");
    if (!contributionId) return NextResponse.json({ error: "contributionId requis" }, { status: 400 });
    const existing = await db.projectContribution.findUnique({ where: { id: contributionId } });
    if (!existing || existing.projectId !== id) {
      return NextResponse.json({ error: "Apport introuvable" }, { status: 404 });
    }
    await db.projectContribution.delete({ where: { id: contributionId } });
    await audit(admin.id, "DELETE", "ProjectContribution", contributionId, `Retrait d'un apport au projet « ${id} »`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
