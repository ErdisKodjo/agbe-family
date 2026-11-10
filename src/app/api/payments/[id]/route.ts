// PATCH /api/payments/[id] — Valider / rejeter un paiement (admin)
//   → la trésorerie du registre est créditée automatiquement (recette)
// P0 : garde anti-double-crédit (updateMany dans la transaction).
// P1 : withAdmin (DRY) + zod (validation) + withTransaction (Unit of Work).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { withAdmin } from "@/lib/api-handler";
import { withTransaction } from "@/lib/transaction";
import { ValidatePaymentActionSchema, validationError } from "@/lib/validation";

class AlreadyProcessedError extends Error {}

export const PATCH = withAdmin(async (req: NextRequest, { admin, params }) => {
  const { id } = params;
  const body = await req.json();
  const parsed = ValidatePaymentActionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { action } = parsed.data;

  // Lecture hors transaction : libellé + 404 lisible. Le garde atomique est dans la transaction.
  const existing = await db.payment.findUnique({
    where: { id },
    include: { member: true, campaign: true },
  });
  if (!existing) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });

  if (action === "VALIDATE") {
    try {
      await withTransaction(async (tx) => {
        // GARDE ANTI-DOUBLE-CRÉDIT : transition PENDING → VALIDATED atomique.
        const { count } = await tx.payment.updateMany({
          where: { id, status: "PENDING" },
          data: { status: "VALIDATED", validatedAt: new Date(), validatedById: admin.id },
        });
        if (count !== 1) throw new AlreadyProcessedError();

        const registryId = existing.campaign?.registryId ?? existing.member.registryId;
        if (registryId) {
          await tx.transaction.create({
            data: {
              registryId,
              type: "INCOME",
              date: new Date(),
              label: `Cotisation — ${existing.member.firstName} ${existing.member.lastName}${existing.campaign ? ` (${existing.campaign.name})` : ""}`,
              category: "COTISATION",
              amount: existing.amount,
              note: `Paiement #${existing.id} validé`,
              recordedById: admin.id,
            },
          });
        }
      });
    } catch (e) {
      if (e instanceof AlreadyProcessedError) {
        return NextResponse.json({ error: "Ce paiement a déjà été traité" }, { status: 409 });
      }
      throw e;
    }
    await audit(admin.id, "VALIDATE", "Payment", id, `Paiement de ${existing.amount} FCFA validé (${existing.member.firstName} ${existing.member.lastName})`);
    return NextResponse.json({ ok: true });
  }

  // REJECT : même garde atomique (évite un double rejet concurrent)
  const { count } = await db.payment.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED", validatedAt: new Date(), validatedById: admin.id },
  });
  if (count !== 1) {
    return NextResponse.json({ error: "Ce paiement a déjà été traité" }, { status: 409 });
  }
  await audit(admin.id, "REJECT", "Payment", id, `Paiement de ${existing.amount} FCFA rejeté (${existing.member.firstName} ${existing.member.lastName})`);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAdmin(async (_req: NextRequest, { admin, params }) => {
  const { id } = params;
  const existing = await db.payment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  if (existing.status === "VALIDATED") {
    return NextResponse.json({ error: "Impossible de supprimer un paiement validé (traçabilité)" }, { status: 400 });
  }
  await db.payment.delete({ where: { id } });
  await audit(admin.id, "DELETE", "Payment", id, `Suppression d'un paiement de ${existing.amount} FCFA`);
  return NextResponse.json({ ok: true });
});
