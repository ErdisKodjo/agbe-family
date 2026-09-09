// GET /api/projects — Liste des projets (+ avancement, financement)
//   ?registryId= &status= &mine=1 (projets auxquels je contribue)
// POST /api/projects — Créer une fiche projet
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const me = await requireAuth();
    const { searchParams } = new URL(req.url);
    const registryId = searchParams.get("registryId");
    const status = searchParams.get("status");
    const mine = searchParams.get("mine");

    const where: any = {};
    if (registryId && registryId !== "global") where.registryId = registryId;
    if (status) where.status = status;

    if (mine) {
      where.OR = [
        { contributions: { some: { memberId: me.id } } },
        { tasks: { some: { assigneeId: me.id } } },
      ];
    }

    const projects = await db.project.findMany({
      where,
      include: {
        registry: { select: { id: true, name: true } },
        phases: { orderBy: { position: "asc" } },
        tasks: { include: { assignee: { select: { id: true, firstName: true, lastName: true } }, phase: { select: { name: true } } } },
        contributions: {
          include: { member: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { date: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = projects.map((p) => {
      const totalContributed = p.contributions.reduce((s, c) => s + c.amount, 0);
      const phasesProgress = p.phases.length
        ? Math.round(p.phases.reduce((s, ph) => s + ph.progress, 0) / p.phases.length)
        : 0;
      const byMember = new Map<string, { member: any; total: number; cash: number; inKind: number }>();
      p.contributions.forEach((c) => {
        const cur = byMember.get(c.memberId) ?? { member: c.member, total: 0, cash: 0, inKind: 0 };
        cur.total += c.amount;
        if (c.kind === "CASH") cur.cash += c.amount;
        else cur.inKind += c.amount;
        byMember.set(c.memberId, cur);
      });
      return {
        ...p,
        totalContributed,
        phasesProgress,
        fundingRatio: p.budget > 0 ? Math.min(100, Math.round((totalContributed / p.budget) * 100)) : 0,
        contributionsByMember: [...byMember.values()].sort((a, b) => b.total - a.total),
        myContribution: p.contributions.filter((c) => c.memberId === me.id).reduce((s, c) => s + c.amount, 0),
        myTasks: p.tasks.filter((t) => t.assigneeId === me.id),
      };
    });

    return NextResponse.json({ projects: result });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth();
    if (!isAdmin(me)) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

    const body = await req.json();
    const name = String(body.name || "").trim();
    const registryId = String(body.registryId || "");
    if (!name) return NextResponse.json({ error: "Le nom du projet est requis" }, { status: 400 });
    const registry = await db.registry.findFirst({ where: { id: registryId, isGlobal: false } });
    if (!registry) return NextResponse.json({ error: "Registre valide requis" }, { status: 400 });

    const project = await db.project.create({
      data: {
        name,
        description: body.description ? String(body.description) : null,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : null,
        budget: Number(body.budget) || 0,
        status: String(body.status || "PLANNED"),
        registryId: registry.id,
        phases: {
          create: (Array.isArray(body.phases) ? body.phases : []).map((ph: any, i: number) => ({
            name: String(ph.name || `Phase ${i + 1}`),
            position: i,
            budget: ph.budget ? Number(ph.budget) : null,
          })),
        },
      },
    });

    await audit(me.id, "CREATE", "Project", project.id, `Création du projet « ${name} » (budget ${project.budget} FCFA)`);
    return NextResponse.json({ project });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
