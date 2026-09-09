// GET /api/stats — Statistiques pour les tableaux de bord (selon rôle)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const me = await requireAuth();
    const { searchParams } = new URL(req.url);
    const registryId = searchParams.get("registryId");

    if (isAdmin(me)) {
      // ================= TABLEAU DE BORD ADMIN =================
      const regFilter = registryId && registryId !== "global" ? { registryId } : {};

      const [totalMembers, activeMembers, registriesCount, activeProjects] = await Promise.all([
        db.member.count(),
        db.member.count({ where: { isActive: true } }),
        db.registry.count({ where: { isGlobal: false } }),
        db.project.count({ where: { status: "IN_PROGRESS" } }),
      ]);

      // Trésorerie
      const [inc, exp] = await Promise.all([
        db.transaction.aggregate({ where: { ...regFilter, type: "INCOME" }, _sum: { amount: true } }),
        db.transaction.aggregate({ where: { ...regFilter, type: "EXPENSE" }, _sum: { amount: true } }),
      ]);
      const totalIncome = inc._sum.amount ?? 0;
      const totalExpense = exp._sum.amount ?? 0;
      const balance = totalIncome - totalExpense;

      // Cotisations du mois en cours
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const monthIncome = await db.transaction.aggregate({
        where: { ...regFilter, type: "INCOME", date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      });

      const [pendingPayments, validatedPayments] = await Promise.all([
        db.payment.count({ where: { status: "PENDING" } }),
        db.payment.aggregate({ where: { status: "VALIDATED" }, _sum: { amount: true } }),
      ]);

      // Flux mensuel (6 derniers mois)
      const months: { label: string; income: number; expense: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const [mi, me_] = await Promise.all([
          db.transaction.aggregate({ where: { ...regFilter, type: "INCOME", date: { gte: start, lte: end } }, _sum: { amount: true } }),
          db.transaction.aggregate({ where: { ...regFilter, type: "EXPENSE", date: { gte: start, lte: end } }, _sum: { amount: true } }),
        ]);
        months.push({
          label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(start),
          income: mi._sum.amount ?? 0,
          expense: me_._sum.amount ?? 0,
        });
      }

      // Campagne mensuelle courante : payés / retardataires
      const currentMonthly = await db.contributionCampaign.findFirst({
        where: {
          type: "MONTHLY",
          status: "ACTIVE",
          periodMonth: now.getMonth() + 1,
          periodYear: now.getFullYear(),
        },
        include: {
          pledges: { include: { member: { select: { id: true, firstName: true, lastName: true, phone: true, registryId: true } } } },
          payments: { where: { status: "VALIDATED" }, select: { memberId: true, amount: true } },
        },
      });

      let monthlyStatus: any = null;
      if (currentMonthly) {
        const paidMap = new Map<string, number>();
        currentMonthly.payments.forEach((p) => paidMap.set(p.memberId, (paidMap.get(p.memberId) ?? 0) + p.amount));
        const expected = currentMonthly.pledges.reduce((s, p) => s + p.amountDue, 0);
        const collected = currentMonthly.payments.reduce((s, p) => s + p.amount, 0);
        monthlyStatus = {
          id: currentMonthly.id,
          name: currentMonthly.name,
          amount: currentMonthly.amount,
          dueDay: currentMonthly.dueDay,
          expected,
          collected,
          paidCount: currentMonthly.pledges.filter((p) => (paidMap.get(p.memberId) ?? 0) >= p.amountDue && p.amountDue > 0).length,
          totalMembers: currentMonthly.pledges.length,
          late: currentMonthly.pledges
            .filter((p) => (paidMap.get(p.memberId) ?? 0) < p.amountDue)
            .map((p) => ({
              member: p.member,
              amountDue: p.amountDue,
              amountPaid: paidMap.get(p.memberId) ?? 0,
              rest: p.amountDue - (paidMap.get(p.memberId) ?? 0),
            })),
        };
      }

      // Activité récente (audit)
      const recentActivity = await db.auditLog.findMany({
        include: { member: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      });

      // Répartition des recettes par catégorie (12 derniers mois)
      const catIncomes = await db.transaction.groupBy({
        by: ["category"],
        where: { ...regFilter, type: "INCOME" },
        _sum: { amount: true },
      });

      return NextResponse.json({
        scope: "admin",
        kpis: {
          totalMembers,
          activeMembers,
          registriesCount,
          activeProjects,
          balance,
          totalIncome,
          totalExpense,
          monthCollected: monthIncome._sum.amount ?? 0,
          pendingPayments,
          totalCollected: validatedPayments._sum.amount ?? 0,
        },
        months,
        monthlyStatus,
        recentActivity,
        catIncomes: catIncomes.map((c) => ({ category: c.category, amount: c._sum.amount ?? 0 })),
      });
    } else {
      // ================= TABLEAU DE BORD MEMBRE =================
      // Ma situation financière
      const myPayments = await db.payment.findMany({
        where: { memberId: me.id },
        include: { campaign: { select: { id: true, name: true, type: true } } },
        orderBy: { paidAt: "desc" },
      });

      const myPledges = await db.contributionPledge.findMany({
        where: { memberId: me.id, campaign: { status: "ACTIVE" } },
        include: { campaign: { include: { payments: { where: { status: "VALIDATED", memberId: me.id } } } } },
      });

      const totalPaid = myPayments.filter((p) => p.status === "VALIDATED").reduce((s, p) => s + p.amount, 0);
      const totalDue = myPledges.reduce((s, p) => s + p.amountDue, 0);
      const totalPaidOnActive = myPledges.reduce((s, p) => s + p.campaign.payments.reduce((ss, pp) => ss + pp.amount, 0), 0);
      const restToPay = Math.max(0, totalDue - totalPaidOnActive);
      const pendingMine = myPayments.filter((p) => p.status === "PENDING").length;

      // Mes projets
      const myProjects = await db.project.findMany({
        where: {
          status: { in: ["IN_PROGRESS", "PLANNED"] },
          OR: [{ contributions: { some: { memberId: me.id } } }, { tasks: { some: { assigneeId: me.id } } }],
        },
        include: {
          phases: { orderBy: { position: "asc" } },
          tasks: { where: { assigneeId: me.id }, include: { phase: { select: { name: true } } } },
          contributions: { where: { memberId: me.id } },
        },
      });

      const myTasks = await db.projectTask.findMany({
        where: { assigneeId: me.id, status: { in: ["TODO", "IN_PROGRESS"] } },
        include: { project: { select: { name: true } }, phase: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
      });

      // Détail par campagne active
      const myCampaigns = myPledges.map((p) => {
        const paid = p.campaign.payments.reduce((s, pp) => s + pp.amount, 0);
        return {
          campaign: {
            id: p.campaign.id,
            name: p.campaign.name,
            type: p.campaign.type,
            dueDay: p.campaign.dueDay,
            endDate: p.campaign.endDate,
          },
          amountDue: p.amountDue,
          amountPaid: paid,
          rest: Math.max(0, p.amountDue - paid),
        };
      });

      return NextResponse.json({
        scope: "member",
        kpis: {
          totalPaid,
          totalDue,
          restToPay,
          pendingMine,
          myProjectsCount: myProjects.length,
          myOpenTasks: myTasks.length,
          myProjectContributions: myProjects.reduce((s, p) => s + p.contributions.reduce((ss, c) => ss + c.amount, 0), 0),
        },
        myCampaigns,
        myTasks,
        myProjects: myProjects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          phasesProgress: p.phases.length ? Math.round(p.phases.reduce((s, ph) => s + ph.progress, 0) / p.phases.length) : 0,
          myContribution: p.contributions.reduce((s, c) => s + c.amount, 0),
          myTasks: p.tasks,
        })),
        recentPayments: myPayments.slice(0, 10),
      });
    }
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
