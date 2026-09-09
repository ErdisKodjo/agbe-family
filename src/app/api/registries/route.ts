// GET /api/registries — Liste des registres (+ effectifs, soldes)
// POST /api/registries — Création d'un registre (groupe)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, getCurrentMember, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { DEFAULT_PASSWORD, ROLES } from "@/lib/constants";

export async function GET() {
  try {
    const member = await getCurrentMember();
    if (!member) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const registries = await db.registry.findMany({
      where: { isGlobal: false },
      include: {
        _count: { select: { members: true, projects: true, campaigns: true } },
        headMember: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const totalMembers = await db.member.count({ where: { isActive: true } });

    // Soldes de trésorerie par registre
    const incomes = await db.transaction.groupBy({
      by: ["registryId"],
      where: { type: "INCOME" },
      _sum: { amount: true },
    });
    const expenses = await db.transaction.groupBy({
      by: ["registryId"],
      where: { type: "EXPENSE" },
      _sum: { amount: true },
    });
    const balanceMap = new Map<string, number>();
    incomes.forEach((i) => balanceMap.set(i.registryId, (balanceMap.get(i.registryId) ?? 0) + (i._sum.amount ?? 0)));
    expenses.forEach((e) => balanceMap.set(e.registryId, (balanceMap.get(e.registryId) ?? 0) - (e._sum.amount ?? 0)));

    const result = registries.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      transparency: r.transparency,
      headMember: r.headMember,
      membersCount: r._count.members,
      projectsCount: r._count.projects,
      campaignsCount: r._count.campaigns,
      balance: balanceMap.get(r.id) ?? 0,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({
      registries: result,
      global: {
        name: "Registre Global",
        membersCount: totalMembers,
        balance: [...balanceMap.values()].reduce((a, b) => a + b, 0),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Le nom du registre est requis" }, { status: 400 });

    // Créer le registre + éventuellement sa tête de liste
    const headMemberId = body.headMemberId ? String(body.headMemberId) : null;

    const registry = await db.registry.create({
      data: {
        name,
        description: body.description ? String(body.description) : null,
        transparency: Boolean(body.transparency),
        headMemberId,
      },
    });

    // Si une tête de liste est désignée et qu'elle existe dans un autre registre,
    // on promeut son rôle sur ce registre.
    if (headMemberId) {
      await db.member.update({ where: { id: headMemberId }, data: { role: ROLES.HEAD } }).catch(() => {});
    }

    await audit(admin.id, "CREATE", "Registry", registry.id, `Création du registre « ${name} »`);
    return NextResponse.json({ registry });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
