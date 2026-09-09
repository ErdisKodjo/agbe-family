// GET /api/reports?type=… — Données pour rapports officiels
// Types : annuaire | grand-livre | balance | cotisations | projet | pv
// Les exports (PDF via impression, CSV/Excel, Word) sont générés côté client.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, isAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const me = await requireAuth();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "annuaire";
    const registryId = searchParams.get("registryId");
    const projectId = searchParams.get("projectId");
    const regFilter = registryId && registryId !== "global" ? registryId : null;

    switch (type) {
      // ------------------------------------------------------------
      case "annuaire": {
        // Liste des membres, groupée par registre, avec localité
        const members = await db.member.findMany({
          where: {
            isActive: true,
            ...(regFilter ? { registryId: regFilter } : {}),
          },
          include: { registry: { select: { name: true } } },
          orderBy: [{ registry: { name: "asc" } }, { lastName: "asc" }],
        });
        const byRegistry = new Map<string, any[]>();
        members.forEach((m) => {
          const key = m.registry.name;
          if (!byRegistry.has(key)) byRegistry.set(key, []);
          byRegistry.get(key)!.push({
            lastName: m.lastName,
            firstName: m.firstName,
            phone: m.phone,
            city: m.city ?? "—",
            position: m.position ?? "—",
            role: m.role,
            joinedAt: m.joinedAt ?? m.createdAt,
          });
        });
        const byCity = new Map<string, number>();
        members.forEach((m) => byCity.set(m.city ?? "Non renseignée", (byCity.get(m.city ?? "Non renseignée") ?? 0) + 1));
        return NextResponse.json({
          type,
          generatedAt: new Date().toISOString(),
          total: members.length,
          groups: [...byRegistry.entries()].map(([registry, list]) => ({ registry, list })),
          cities: [...byCity.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count),
        });
      }

      // ------------------------------------------------------------
      case "grand-livre": {
        if (!isAdmin(me)) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
        // Journal de caisse complet chronologique avec solde progressif
        const transactions = await db.transaction.findMany({
          where: regFilter ? { registryId: regFilter } : {},
          include: {
            registry: { select: { name: true } },
            recordedBy: { select: { firstName: true, lastName: true } },
          },
          orderBy: { date: "asc" },
        });
        let running = 0;
        const entries = transactions.map((t) => {
          running += t.type === "INCOME" ? t.amount : -t.amount;
          return {
            date: t.date,
            registry: t.registry.name,
            label: t.label,
            category: t.category,
            type: t.type,
            amount: t.amount,
            balance: running,
            attachment: t.attachmentUrl ? true : false,
            recordedBy: t.recordedBy ? `${t.recordedBy.firstName} ${t.recordedBy.lastName}` : "—",
          };
        });
        return NextResponse.json({
          type,
          generatedAt: new Date().toISOString(),
          entries,
          totalIncome: transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0),
          totalExpense: transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0),
          finalBalance: running,
        });
      }

      // ------------------------------------------------------------
      case "balance": {
        if (!isAdmin(me)) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
        // Balance par catégorie (recettes / dépenses)
        const [incomes, expenses] = await Promise.all([
          db.transaction.groupBy({
            by: ["category"],
            where: { type: "INCOME", ...(regFilter ? { registryId: regFilter } : {}) },
            _sum: { amount: true },
            _count: true,
          }),
          db.transaction.groupBy({
            by: ["category"],
            where: { type: "EXPENSE", ...(regFilter ? { registryId: regFilter } : {}) },
            _sum: { amount: true },
            _count: true,
          }),
        ]);
        const totalIncome = incomes.reduce((s, c) => s + (c._sum.amount ?? 0), 0);
        const totalExpense = expenses.reduce((s, c) => s + (c._sum.amount ?? 0), 0);
        return NextResponse.json({
          type,
          generatedAt: new Date().toISOString(),
          incomes: incomes.map((c) => ({ category: c.category, amount: c._sum.amount ?? 0, count: c._count })),
          expenses: expenses.map((c) => ({ category: c.category, amount: c._sum.amount ?? 0, count: c._count })),
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense,
        });
      }

      // ------------------------------------------------------------
      case "cotisations": {
        if (!isAdmin(me)) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
        // État des cotisations : à jour vs retardataires, toutes campagnes actives
        const campaigns = await db.contributionCampaign.findMany({
          where: { status: "ACTIVE", ...(regFilter ? { registryId: regFilter } : {}) },
          include: {
            pledges: { include: { member: { select: { firstName: true, lastName: true, phone: true, city: true, registry: { select: { name: true } } } } } },
            payments: { where: { status: "VALIDATED" }, select: { memberId: true, amount: true } },
          },
          orderBy: { createdAt: "asc" },
        });
        const report = campaigns.map((c) => {
          const paidMap = new Map<string, number>();
          c.payments.forEach((p) => paidMap.set(p.memberId, (paidMap.get(p.memberId) ?? 0) + p.amount));
          const rows = c.pledges.map((p) => {
            const paid = paidMap.get(p.memberId) ?? 0;
            return {
              member: `${p.member.lastName} ${p.member.firstName}`,
              phone: p.member.phone,
              registry: p.member.registry.name,
              amountDue: p.amountDue,
              amountPaid: paid,
              rest: Math.max(0, p.amountDue - paid),
              status: paid >= p.amountDue && p.amountDue > 0 ? "À jour" : paid > 0 ? "Partiel" : "En retard",
            };
          });
          return {
            campaign: c.name,
            type: c.type,
            dueDay: c.dueDay,
            periodMonth: c.periodMonth,
            periodYear: c.periodYear,
            rows: rows.sort((a, b) => b.rest - a.rest),
            expected: c.pledges.reduce((s, p) => s + p.amountDue, 0),
            collected: c.payments.reduce((s, p) => s + p.amount, 0),
          };
        });
        return NextResponse.json({ type, generatedAt: new Date().toISOString(), campaigns: report });
      }

      // ------------------------------------------------------------
      case "projet": {
        if (!projectId) return NextResponse.json({ error: "projectId requis" }, { status: 400 });
        const project = await db.project.findUnique({
          where: { id: projectId },
          include: {
            registry: { select: { name: true } },
            phases: { orderBy: { position: "asc" }, include: { tasks: { include: { assignee: { select: { firstName: true, lastName: true } } } } } },
            tasks: { include: { assignee: { select: { firstName: true, lastName: true } } } },
            contributions: { include: { member: { select: { firstName: true, lastName: true } } }, orderBy: { date: "asc" } },
          },
        });
        if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
        const totalContributed = project.contributions.reduce((s, c) => s + c.amount, 0);
        const byMember = new Map<string, { member: string; total: number; cash: number; inKind: number; count: number }>();
        project.contributions.forEach((c) => {
          const key = `${c.member.lastName} ${c.member.firstName}`;
          const cur = byMember.get(key) ?? { member: key, total: 0, cash: 0, inKind: 0, count: 0 };
          cur.total += c.amount;
          if (c.kind === "CASH") cur.cash += c.amount;
          else cur.inKind += c.amount;
          cur.count += 1;
          byMember.set(key, cur);
        });
        return NextResponse.json({
          type,
          generatedAt: new Date().toISOString(),
          project: {
            name: project.name,
            description: project.description,
            registry: project.registry.name,
            startDate: project.startDate,
            endDate: project.endDate,
            budget: project.budget,
            status: project.status,
          },
          phases: project.phases.map((ph) => ({
            name: ph.name,
            progress: ph.progress,
            status: ph.status,
            budget: ph.budget,
            tasks: ph.tasks.map((t) => ({
              title: t.title,
              status: t.status,
              assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "Non assignée",
            })),
          })),
          financing: {
            totalContributed,
            cash: project.contributions.filter((c) => c.kind === "CASH").reduce((s, c) => s + c.amount, 0),
            inKind: project.contributions.filter((c) => c.kind === "IN_KIND").reduce((s, c) => s + c.amount, 0),
            ratio: project.budget > 0 ? Math.min(100, Math.round((totalContributed / project.budget) * 100)) : 0,
            byMember: [...byMember.values()].sort((a, b) => b.total - a.total),
          },
        });
      }

      // ------------------------------------------------------------
      case "pv": {
        if (!isAdmin(me)) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
        // PV de réunion : généré à partir des saisies des 30 derniers jours
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        const [membersCount, newMembers, payments, transactions, projects, logs] = await Promise.all([
          db.member.count({ where: { isActive: true } }),
          db.member.count({ where: { createdAt: { gte: since }, isActive: true } }),
          db.payment.findMany({
            where: { paidAt: { gte: since } },
            include: { member: { select: { firstName: true, lastName: true } }, campaign: { select: { name: true } } },
            orderBy: { paidAt: "desc" },
            take: 50,
          }),
          db.transaction.findMany({
            where: { date: { gte: since } },
            include: { registry: { select: { name: true } } },
            orderBy: { date: "desc" },
            take: 60,
          }),
          db.project.findMany({
            where: { updatedAt: { gte: since } },
            include: { phases: { orderBy: { position: "asc" } } },
          }),
          db.auditLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 40, include: { member: { select: { firstName: true, lastName: true } } } }),
        ]);
        const [inc, exp] = await Promise.all([
          db.transaction.aggregate({ where: { type: "INCOME", date: { gte: since } }, _sum: { amount: true } }),
          db.transaction.aggregate({ where: { type: "EXPENSE", date: { gte: since } }, _sum: { amount: true } }),
        ]);
        const validatedPayments = payments.filter((p) => p.status === "VALIDATED");
        return NextResponse.json({
          type,
          generatedAt: new Date().toISOString(),
          periodStart: since.toISOString(),
          membersCount,
          newMembers,
          treasury: {
            income: inc._sum.amount ?? 0,
            expense: exp._sum.amount ?? 0,
            balance: (inc._sum.amount ?? 0) - (exp._sum.amount ?? 0),
          },
          contributions: {
            totalValidated: validatedPayments.length,
            totalAmount: validatedPayments.reduce((s, p) => s + p.amount, 0),
            pending: payments.filter((p) => p.status === "PENDING").length,
            recent: validatedPayments.slice(0, 12).map((p) => ({
              member: `${p.member.firstName} ${p.member.lastName}`,
              amount: p.amount,
              campaign: p.campaign?.name ?? "Cotisation libre",
              date: p.paidAt,
            })),
          },
          expenses: transactions
            .filter((t) => t.type === "EXPENSE")
            .slice(0, 12)
            .map((t) => ({ label: t.label, amount: t.amount, registry: t.registry.name, date: t.date })),
          projects: projects.map((p) => ({
            name: p.name,
            status: p.status,
            budget: p.budget,
            progress: p.phases.length ? Math.round(p.phases.reduce((s, ph) => s + ph.progress, 0) / p.phases.length) : 0,
          })),
          actions: logs.slice(0, 20).map((l) => ({
            who: l.member ? `${l.member.firstName} ${l.member.lastName}` : "Système",
            action: l.action,
            entity: l.entityType,
            details: l.details,
            at: l.createdAt,
          })),
        });
      }

      default:
        return NextResponse.json({ error: "Type de rapport inconnu" }, { status: 400 });
    }
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
