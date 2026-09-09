// GET /api/members — Liste des membres
//   ?registryId=xxx → membres d'un registre spécifique
//   ?registryId=global → « Registre Global » : TOUS les membres (vue maître)
//   ?search=  &role=
// POST /api/members — Ajout d'un membre (réplication automatique
//   au Registre Global par construction : la vue globale aggrège)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, getCurrentMember, hashPassword, normalizePhone, isValidPhone } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { DEFAULT_PASSWORD, ROLES } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const registryId = searchParams.get("registryId");
    const search = searchParams.get("search")?.trim() || "";
    const role = searchParams.get("role")?.trim() || "";

    const where: any = { isActive: true };
    if (registryId && registryId !== "global") where.registryId = registryId;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const members = await db.member.findMany({
      where,
      include: {
        registry: { select: { id: true, name: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    // Statistiques financières par membre (pour admins uniquement)
    const ADMIN_ROLES_ARR = [ROLES.SUPER_ADMIN, ROLES.HEAD, ROLES.TREASURER];
    let statsMap: Map<string, { totalPaid: number; pendingCount: number }> | null = null;
    if (ADMIN_ROLES_ARR.includes(me.role)) {
      statsMap = new Map();
      const validated = await db.payment.groupBy({
        by: ["memberId"],
        where: { status: "VALIDATED" },
        _sum: { amount: true },
      });
      validated.forEach((v) => statsMap!.set(v.memberId, { totalPaid: v._sum.amount ?? 0, pendingCount: 0 }));
      const pending = await db.payment.groupBy({
        by: ["memberId"],
        where: { status: "PENDING" },
        _count: true,
      });
      pending.forEach((p) => {
        const cur = statsMap!.get(p.memberId) ?? { totalPaid: 0, pendingCount: 0 };
        cur.pendingCount = p._count;
        statsMap!.set(p.memberId, cur);
      });
    }

    const result = members.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      phone: m.phone,
      city: m.city,
      position: m.position,
      role: m.role,
      registry: m.registry,
      mustChangePassword: m.mustChangePassword,
      joinedAt: m.createdAt,
      totalPaid: statsMap?.get(m.id)?.totalPaid ?? null,
      pendingCount: statsMap?.get(m.id)?.pendingCount ?? null,
    }));

    return NextResponse.json({ members: result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const phone = normalizePhone(String(body.phone || ""));
    const registryId = String(body.registryId || "");
    const role = String(body.role || ROLES.MEMBER);

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Nom et prénoms requis" }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "Numéro de téléphone invalide (format international requis, ex: +22890123456)" }, { status: 400 });
    }
    const registry = await db.registry.findFirst({ where: { id: registryId, isGlobal: false } });
    if (!registry) return NextResponse.json({ error: "Registre valide requis" }, { status: 400 });

    const existing = await db.member.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json({ error: "Ce numéro de téléphone est déjà enregistré" }, { status: 409 });
    }

    const member = await db.member.create({
      data: {
        firstName,
        lastName,
        phone,
        city: body.city ? String(body.city).trim() : null,
        position: body.position ? String(body.position).trim() : null,
        registryId: registry.id,
        role,
        passwordHash: hashPassword(body.password ? String(body.password) : DEFAULT_PASSWORD),
        mustChangePassword: true,
      },
      include: { registry: { select: { name: true } } },
    });

    await audit(
      admin.id,
      "CREATE",
      "Member",
      member.id,
      `Ajout du membre ${firstName} ${lastName} au registre « ${registry.name} » (répliqué au Registre Global)`
    );
    return NextResponse.json({
      member: { ...member, passwordHash: undefined },
      defaultPassword: body.password ? undefined : DEFAULT_PASSWORD,
    });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
