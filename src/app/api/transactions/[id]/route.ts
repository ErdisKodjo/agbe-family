// PATCH /api/transactions/[id] — Corriger une écriture
// DELETE /api/transactions/[id] — Supprimer une écriture
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/constants";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Écriture introuvable" }, { status: 404 });

    const data: any = {};
    if (body.label != null) data.label = String(body.label).trim();
    if (body.amount != null) data.amount = Number(body.amount);
    if (body.date != null) data.date = new Date(body.date);
    if (body.note !== undefined) data.note = body.note ? String(body.note) : null;
    if (body.category != null) {
      const cats = existing.type === "INCOME" ? Object.keys(INCOME_CATEGORIES) : Object.keys(EXPENSE_CATEGORIES);
      if (!cats.includes(String(body.category))) {
        return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
      }
      data.category = String(body.category);
    }

    const transaction = await db.transaction.update({ where: { id }, data });
    await audit(admin.id, "UPDATE", "Transaction", id, `Correction de l'écriture « ${transaction.label} »`);
    return NextResponse.json({ transaction });
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
    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Écriture introuvable" }, { status: 404 });
    await db.transaction.delete({ where: { id } });
    await audit(admin.id, "DELETE", "Transaction", id, `Suppression de l'écriture « ${existing.label} » (${existing.amount} FCFA)`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
