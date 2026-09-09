// PATCH /api/payments/[id] — Valider / rejeter un paiement (admin)
//   → la trésorerie du registre est créditée automatiquement (recette)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { PAYMENT_STATUSES, INCOME_CATEGORIES } from "@/lib/constants";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const action = String(body.action || ""); // VALIDATE | REJECT
    const existing = await db.payment.findUnique({
      where: { id },
      include: { member: true, campaign: true },
    });
    if (!existing) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Ce paiement a déjà été traité" }, { status: 400 });
    }

    if (action === PAYMENT_STATUSES.VALIDATED) {
      await db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id },
          data: { status: "VALIDATED", validatedAt: new Date(), validatedById: admin.id },
        });
        // Encaissement automatique dans le journal de caisse du registre
        const registryId = existing.campaign?.registryId ?? existing.member.registryId;
        if (registryId) {
          await tx.transaction.create({
            data: {
              registryId,
              type: "INCOME",
              date: new Date(),
              label: `Cotisation — ${existing.member.firstName} ${existing.member.lastName}${existing.campaign ? ` (${existing.campaign.name})` : ""}`,
              category: INCOME_CATEGORIES.COTISATION ? "COTISATION" : "AUTRE",
              amount: existing.amount,
              note: `Paiement #${existing.id} validé`,
              recordedById: admin.id,
            },
          });
        }
      });
      await audit(admin.id, "VALIDATE", "Payment", id, `Paiement de ${existing.amount} FCFA validé (${existing.member.firstName} ${existing.member.lastName})`);
      return NextResponse.json({ ok: true });
    } else if (action === PAYMENT_STATUSES.REJECTED) {
      await db.payment.update({
        where: { id },
        data: { status: "REJECTED", validatedAt: new Date(), validatedById: admin.id },
      });
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
