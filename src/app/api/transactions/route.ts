// GET /api/transactions — Journal de caisse (+ solde temps réel)
//   ?registryId= &type= &category= &from= &to= &period=
// POST /api/transactions — Saisie d'un flux (entrée/sortie) + pièce jointe
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { TRANSACTION_TYPES, INCOME_CATEGORIES, EXPENSE_CATEGORIES, ROLES } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const me = await requireAuth();
    const { searchParams } = new URL(req.url);
    const registryId = searchParams.get("registryId");
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = {};
    if (registryId && registryId !== "global") where.registryId = registryId;
    if (type) where.type = type;
    if (category) where.category = category;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to + "T23:59:59");
    }

    const transactions = await db.transaction.findMany({
      where,
      include: {
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
        registry: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
    });

    // Solde temps réel (indépendant des filtres)
    const balanceWhere: any = {};
    if (registryId && registryId !== "global") balanceWhere.registryId = registryId;
    const inc = await db.transaction.aggregate({
      where: { ...balanceWhere, type: TRANSACTION_TYPES.INCOME },
      _sum: { amount: true },
    });
    const exp = await db.transaction.aggregate({
      where: { ...balanceWhere, type: TRANSACTION_TYPES.EXPENSE },
      _sum: { amount: true },
    });

    const totalIncome = inc._sum.amount ?? 0;
    const totalExpense = exp._sum.amount ?? 0;

    return NextResponse.json({
      transactions,
      balance: {
        totalIncome,
        totalExpense,
        current: totalIncome - totalExpense,
      },
    });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth();
    if (!isAdmin(me)) {
      return NextResponse.json({ error: "Réservé aux administrateurs et trésoriers" }, { status: 403 });
    }
    const body = await req.json();
    const type = String(body.type || "");
    const label = String(body.label || "").trim();
    const amount = Number(body.amount);
    const category = String(body.category || "AUTRE");
    const registryId = String(body.registryId || "");

    if (![TRANSACTION_TYPES.INCOME, TRANSACTION_TYPES.EXPENSE].includes(type as any)) {
      return NextResponse.json({ error: "Type de flux invalide" }, { status: 400 });
    }
    if (!label) return NextResponse.json({ error: "Libellé requis" }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });

    const validCategories = type === TRANSACTION_TYPES.INCOME ? Object.keys(INCOME_CATEGORIES) : Object.keys(EXPENSE_CATEGORIES);
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Catégorie invalide pour ce type de flux" }, { status: 400 });
    }
    const registry = await db.registry.findFirst({ where: { id: registryId, isGlobal: false } });
    if (!registry) return NextResponse.json({ error: "Registre valide requis" }, { status: 400 });

    const transaction = await db.transaction.create({
      data: {
        registryId: registry.id,
        type,
        date: body.date ? new Date(body.date) : new Date(),
        label,
        category,
        amount,
        attachmentUrl: body.attachmentUrl ? String(body.attachmentUrl) : null,
        note: body.note ? String(body.note) : null,
        recordedById: me.id,
      },
    });

    await audit(me.id, "CREATE", "Transaction", transaction.id, `${type === "INCOME" ? "Recette" : "Dépense"} : ${label} (${amount} FCFA)`);
    return NextResponse.json({ transaction });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
