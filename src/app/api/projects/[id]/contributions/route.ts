// ============================================================
// P0 — CORRECTIONS ACID #2 et #3
// Fichier d'origine : src/app/api/projects/[id]/contributions/route.ts
//
// PROBLÈME #2 (POST) : projectContribution.create puis transaction.create
// étaient DEUX awaits séparés, sans transaction. Si le 2e échouait :
// apport enregistré mais trésorerie non créditée → solde faux.
//
// PROBLÈME #3 (DELETE) : la suppression d'un apport CASH n'annulait pas
// l'écriture INCOME de trésorerie correspondante → déséquilibre permanent.
//
// CORRECTIFS :
//   POST → les deux écritures dans un $transaction unique.
//   DELETE → écriture d'annulation (contrepartie comptable) dans la même
//            transaction que la suppression. On ne SUPPRIME jamais une
//            écriture de caisse (traçabilité) : on crée une écriture
//            inverse. On recommande au passage d'ajouter un champ
//            `linkedTransactionId` au modèle ProjectContribution pour
//            lier explicitement l'apport à son écriture de caisse.
// ============================================================
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

    // ---- Atomique : apport + (si numéraire) écriture de caisse ----
    const contribution = await db.$transaction(async (tx) => {
      const created = await tx.projectContribution.create({
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
        await tx.transaction.create({
          data: {
            registryId: project.registryId,
            type: "INCOME",
            date: created.date,
            label: `Apport projet « ${project.name} » — ${created.member.firstName} ${created.member.lastName}`,
            category: "PROJET",
            amount,
            note: `Apport #${created.id}`,
            recordedById: me.id,
          },
        });
      }
      return created;
    });

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

    const existing = await db.projectContribution.findUnique({
      where: { id: contributionId },
      include: { project: { select: { name: true, registryId: true } } },
    });
    if (!existing || existing.projectId !== id) {
      return NextResponse.json({ error: "Apport introuvable" }, { status: 404 });
    }

    // ---- Atomique : suppression de l'apport + contrepartie de caisse ----
    await db.$transaction(async (tx) => {
      await tx.projectContribution.delete({ where: { id: contributionId } });

      // Si c'était un apport numéraire, on annule l'écriture INCOME
      // par une écriture inverse (EXPENSE) — on ne supprime jamais
      // une ligne du journal de caisse (traçabilité comptable).
      if (existing.kind === "CASH" && existing.amount > 0) {
        await tx.transaction.create({
          data: {
            registryId: existing.project.registryId,
            type: "EXPENSE",
            date: new Date(),
            label: `Annulation apport projet « ${existing.project.name} » (#${contributionId})`,
            category: "AUTRE",
            amount: existing.amount,
            note: `Contrepartie de suppression de l'apport #${contributionId}`,
            recordedById: admin.id,
          },
        });
      }
    });

    await audit(admin.id, "DELETE", "ProjectContribution", contributionId, `Retrait d'un apport au projet « ${id} »`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
