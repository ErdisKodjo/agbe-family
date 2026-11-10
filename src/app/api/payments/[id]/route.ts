// ============================================================
// P0 — CORRECTION ACID #1 (double-crédit silencieux)
// Fichier d'origine : src/app/api/payments/[id]/route.ts
//
// PROBLÈME : la lecture du statut PENDING était hors transaction.
// Deux admins validant en même temps passaient tous les deux le garde
// et créaient chacun une écriture INCOME → trésorerie créditée 2×.
//
// CORRECTIF : garde atomique `updateMany({ where: { id, status: "PENDING" } })`
// À L'INTÉRIEUR de la transaction, avec exigence count === 1.
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { PAYMENT_STATUSES } from "@/lib/constants";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const action = String(body.action || ""); // VALIDATE | REJECT

    // Lecture hors transaction OK ici : elle ne sert qu'à construire le libellé
    // et à renvoyer un 404 lisible. Le garde atomique est dans la transaction.
    const existing = await db.payment.findUnique({
      where: { id },
      include: { member: true, campaign: true },
    });
    if (!existing) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });

    if (action === PAYMENT_STATUSES.VALIDATED) {
      try {
        await db.$transaction(async (tx) => {
          // GARDE ANTI-DOUBLE-CRÉDIT : la transition PENDING → VALIDATED
          // est atomique. Si count === 0, le paiement a déjà été traité
          // (concurrent) → on lève et la transaction est annulée.
          const { count } = await tx.payment.updateMany({
            where: { id, status: "PENDING" },
            data: { status: "VALIDATED", validatedAt: new Date(), validatedById: admin.id },
          });
          if (count !== 1) {
            throw new AlreadyProcessedError("Ce paiement a déjà été traité");
          }

          // Encaissement automatique dans le journal de caisse du registre
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
      } catch (txErr) {
        if (txErr instanceof AlreadyProcessedError) {
          return NextResponse.json({ error: txErr.message }, { status: 409 });
        }
        throw txErr;
      }

      await audit(admin.id, "VALIDATE", "Payment", id, `Paiement de ${existing.amount} FCFA validé (${existing.member.firstName} ${existing.member.lastName})`);
      return NextResponse.json({ ok: true });
    }

    if (action === PAYMENT_STATUSES.REJECTED) {
      // Même garde atomique pour le rejet (évite un double rejet concurrent)
      const { count } = await db.payment.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "REJECTED", validatedAt: new Date(), validatedById: admin.id },
      });
      if (count !== 1) {
        return NextResponse.json({ error: "Ce paiement a déjà été traité" }, { status: 409 });
      }
      await audit(admin.id, "REJECT", "Payment", id, `Paiement de ${existing.amount} FCFA rejeté (${existing.member.firstName} ${existing.member.lastName})`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

class AlreadyProcessedError extends Error {}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const existing = await db.payment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    if (existing.status === "VALIDATED") {
      return NextResponse.json({ error: "Impossible de supprimer un paiement validé (traçabilité)" }, { status: 400 });
    }
    await db.payment.delete({ where: { id } });
    await audit(admin.id, "DELETE", "Payment", id, `Suppression d'un paiement de ${existing.amount} FCFA`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
