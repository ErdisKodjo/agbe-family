// POST /api/projects/[id]/contributions — Enregistrer un apport au projet
// (« qui paie quoi » : numéraire ou en nature)
// P0 : POST atomique + DELETE avec contrepartie de caisse.
// P1 : withAuth/withAdmin (DRY) + zod (validation) + withTransaction.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { withAuth, withAdmin } from "@/lib/api-handler";
import { withTransaction } from "@/lib/transaction";
import { RecordProjectContributionSchema, validationError } from "@/lib/validation";

export const POST = withAuth(async (req: NextRequest, { member: me, params }) => {
  const { id } = params;
  const body = await req.json();
  const parsed = RecordProjectContributionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { memberId: requestedMemberId, amount, kind, description, date } = parsed.data;

  const project = await db.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  // Un membre peut déclarer son propre apport ; seuls les admins peuvent enregistrer pour autrui.
  const memberId = requestedMemberId && isAdmin(me) ? requestedMemberId : me.id;

  // ---- Atomique : apport + (si numéraire) écriture de caisse ----
  const contribution = await withTransaction(async (tx) => {
    const created = await tx.projectContribution.create({
      data: {
        projectId: id,
        memberId,
        amount,
        kind,
        description: description ?? null,
        date: date ? new Date(date) : new Date(),
      },
      include: { member: { select: { firstName: true, lastName: true } } },
    });
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
});

export const DELETE = withAdmin(async (req: NextRequest, { admin, params }) => {
  const { id } = params;
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
  await withTransaction(async (tx) => {
    await tx.projectContribution.delete({ where: { id: contributionId } });
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
});
