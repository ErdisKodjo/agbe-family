"use client";
// ============================================================
// PGF — Tableau de bord Administrateur
// ============================================================
import { useEffect, useState } from "react";
import { get } from "../api";
import type { AdminStats } from "../types";
import { StatCard, PageHeader, MemberAvatar, MoneyText, EmptyState } from "../shared/ui-bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  Users,
  Landmark,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  FolderKanban,
  LayoutDashboard,
  AlertTriangle,
  History,
  Network,
} from "lucide-react";
import { formatMoney, formatMoneyShort, formatDateTime, monthLabel } from "@/lib/format";
import { AUDIT_ACTION_LABELS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminDashboard({ onNavigate }: { onNavigate: (v: any) => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    get<AdminStats>("/api/stats")
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <EmptyState icon={AlertTriangle} title="Impossible de charger les statistiques" description={error} />;
  if (!stats) return <DashboardSkeleton />;

  const k = stats.kpis;
  const monthly = stats.monthlyStatus;
  const paidRatio = monthly && monthly.totalMembers > 0 ? Math.round((monthly.paidCount / monthly.totalMembers) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Tableau de bord"
        description="Vue d'ensemble de la famille : membres, finances et projets."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => onNavigate("registries")}>
              <Network className="w-4 h-4 mr-1.5" /> {k.registriesCount} registre{k.registriesCount > 1 ? "s" : ""}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate("contributions")}>
              <Clock className="w-4 h-4 mr-1.5" /> {k.pendingPayments} paiement(s) à valider
            </Button>
            <Button size="sm" onClick={() => onNavigate("reports")}>
              Générer un rapport
            </Button>
          </>
        }
      />

      {/* ---- KPIs ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Solde de trésorerie"
          value={formatMoney(k.balance)}
          hint={`${formatMoneyShort(k.totalIncome)} entrées · ${formatMoneyShort(k.totalExpense)} sorties`}
          icon={Landmark}
          tone={k.balance >= 0 ? "primary" : "danger"}
        />
        <StatCard title="Cotisations du mois" value={formatMoney(k.monthCollected)} hint="Encaissées ce mois-ci" icon={Wallet} tone="gold" />
        <StatCard title="Membres actifs" value={`${k.activeMembers}`} hint={`${k.registriesCount} registres · ${k.totalMembers} au total`} icon={Users} />
        <StatCard
          title="Projets en cours"
          value={`${k.activeProjects}`}
          hint="Chantiers et événements actifs"
          icon={FolderKanban}
          tone="neutral"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* ---- Flux de trésorerie ---- */}
        <Card className="lg:col-span-2 border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Flux de trésorerie</CardTitle>
            <CardDescription>Entrées et sorties des 6 derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => formatMoneyShort(Number(v))}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [formatMoney(Number(value)), name === "income" ? "Entrées" : "Sorties"]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                      fontSize: 13,
                    }}
                  />
                  <Legend formatter={(v) => (v === "income" ? "Entrées" : "Sorties")} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="income" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#gIncome)" />
                  <Area type="monotone" dataKey="expense" stroke="#e11d48" strokeWidth={2} fill="url(#gExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ---- Cotisation mensuelle courante ---- */}
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cotisation du mois</CardTitle>
            <CardDescription>{monthly ? monthly.name : "Aucune campagne mensuelle active"}</CardDescription>
          </CardHeader>
          <CardContent>
            {monthly ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Encaissé</span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(monthly.collected)} / {formatMoney(monthly.expected)}
                    </span>
                  </div>
                  <Progress value={monthly.expected > 0 ? Math.min(100, (monthly.collected / monthly.expected) * 100) : 0} className="h-2.5" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-emerald-500/10 p-3">
                    <p className="text-xl font-bold text-emerald-700 tabular-nums">{monthly.paidCount}</p>
                    <p className="text-[11px] text-emerald-700/80">à jour sur {monthly.totalMembers}</p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 p-3">
                    <p className="text-xl font-bold text-amber-700 tabular-nums">{monthly.late.length}</p>
                    <p className="text-[11px] text-amber-700/80">en retard</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Échéance : le <b>{monthly.dueDay}</b> de chaque mois · Montant : <b>{formatMoney(monthly.amount)}</b>
                </div>
                {monthly.late.length > 0 && (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <p className="px-3 py-2 text-[11px] font-semibold bg-secondary text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Retardataires (top 4)
                    </p>
                    <div className="max-h-36 overflow-y-auto pgf-scroll divide-y divide-border/60">
                      {monthly.late.slice(0, 4).map((l) => (
                        <div key={l.member.id} className="flex items-center gap-2.5 px-3 py-2">
                          <MemberAvatar firstName={l.member.firstName} lastName={l.member.lastName} size="sm" />
                          <span className="text-xs font-medium flex-1 truncate">
                            {l.member.lastName} {l.member.firstName}
                          </span>
                          <span className="text-xs font-semibold text-amber-700 tabular-nums">{formatMoney(l.rest)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState icon={Wallet} title="Pas de campagne mensuelle" description="Créez une cotisation mensuelle dans le module Cotisations." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* ---- Recettes par catégorie ---- */}
        <Card className="lg:col-span-2 border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recettes par catégorie</CardTitle>
            <CardDescription>Répartition cumulée des entrées de trésorerie</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.catIncomes.map((c) => ({ name: catLabel(c.category), montant: c.amount }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis
                    tickFormatter={(v) => formatMoneyShort(Number(v))}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v: any) => [formatMoney(Number(v)), "Montant"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 13 }}
                  />
                  <Bar dataKey="montant" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ---- Activité récente ---- */}
        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" /> Activité récente
            </CardTitle>
            <CardDescription>Traçabilité des dernières actions</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[260px] overflow-y-auto pgf-scroll divide-y divide-border/60">
              {stats.recentActivity.map((a) => (
                <div key={a.id} className="flex gap-3 px-4 py-2.5">
                  <div className="mt-0.5 rounded-lg bg-secondary p-1.5 shrink-0">
                    {a.action === "VALIDATE" ? (
                      <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                    ) : a.action === "CREATE" ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <History className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs leading-snug line-clamp-2">{a.details || `${AUDIT_ACTION_LABELS[a.action] ?? a.action} · ${a.entityType}`}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                      {a.member ? `${a.member.firstName} ${a.member.lastName} · ` : ""}
                      {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {stats.recentActivity.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune activité enregistrée</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function catLabel(c: string): string {
  const map: Record<string, string> = {
    COTISATION: "Cotisations",
    DON: "Dons",
    VENTE: "Ventes",
    REMBOURSEMENT: "Remboursemts",
    PROJET: "Apports proj.",
    AUTRE: "Autres",
  };
  return map[c] ?? c;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
