"use client";
// ============================================================
// PGF — Tableau de bord personnel du membre
// ============================================================
import { useEffect, useState } from "react";
import { get } from "../api";
import type { MemberStats } from "../types";
import { StatCard, PageHeader, MoneyText, EmptyState, PaymentStatusBadge, FundingBar } from "../shared/ui-bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Wallet, CheckCircle2, LayoutDashboard, FolderKanban, ListChecks, History, ArrowRight } from "lucide-react";
import { formatMoney, formatDate, monthLabel } from "@/lib/format";

export function MemberDashboard({
  memberName,
  onNavigate,
}: {
  memberName: string;
  onNavigate: (v: any) => void;
}) {
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    get<MemberStats>("/api/stats")
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <EmptyState icon={AlertTriangle} title="Erreur de chargement" description={error} />;
  if (!stats)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );

  const k = stats.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title={`Bonjour ${memberName}`}
        description="Votre situation financière et vos contributions aux projets de la famille."
      />

      {/* Ma situation financière */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total cotisé" value={formatMoney(k.totalPaid)} hint="Paiements validés" icon={CheckCircle2} tone="primary" />
        <StatCard title="Reste à payer" value={formatMoney(k.restToPay)} hint={k.pendingMine > 0 ? `${k.pendingMine} paiement(s) en attente` : "Vous êtes à jour 🎉"} icon={Wallet} tone={k.restToPay > 0 ? "gold" : "neutral"} />
        <StatCard title="Mes projets" value={`${k.myProjectsCount}`} hint={`${formatMoney(k.myProjectContributions)} aportés`} icon={FolderKanban} />
        <StatCard title="Mes tâches ouvertes" value={`${k.myOpenTasks}`} hint="À faire dans les projets" icon={ListChecks} tone="neutral" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Mes cotisations dues */}
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mes cotisations en cours</CardTitle>
            <CardDescription>Montants attendus sur les campagnes actives</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.myCampaigns.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Aucune cotisation due" description="Aucune campagne active ne vous concerne actuellement." />
            ) : (
              stats.myCampaigns.map((c) => (
                <div key={c.campaign.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm truncate">{c.campaign.name}</p>
                    <span className={`text-sm font-bold tabular-nums ${c.rest > 0 ? "text-amber-700" : "text-emerald-600"}`}>
                      {c.rest > 0 ? formatMoney(c.rest) : "À jour"}
                    </span>
                  </div>
                  <Progress value={c.amountDue > 0 ? Math.min(100, (c.amountPaid / c.amountDue) * 100) : 100} className="h-2" />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Payé {formatMoney(c.amountPaid)} sur {formatMoney(c.amountDue)}
                    {c.campaign.dueDay ? ` · échéance le ${c.campaign.dueDay}` : ""}
                  </p>
                </div>
              ))
            )}
            <Button className="w-full" variant="outline" onClick={() => onNavigate("my-contributions")}>
              Déclarer un paiement <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Mes tâches */}
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mes tâches (« qui fait quoi »)</CardTitle>
            <CardDescription>Responsabilités qui me sont confiées</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {stats.myTasks.length === 0 ? (
              <EmptyState icon={ListChecks} title="Aucune tâche" description="Aucune tâche ne vous est assignée pour le moment." />
            ) : (
              stats.myTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border p-3.5">
                  <span
                    className={`rounded-lg p-2 shrink-0 ${
                      t.status === "DONE" ? "bg-emerald-500/10 text-emerald-600" : t.status === "IN_PROGRESS" ? "bg-amber-500/10 text-amber-600" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <ListChecks className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {t.project.name}
                      {t.dueDate ? ` · échéance ${formatDate(t.dueDate)}` : ""}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${t.status === "DONE" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                    {t.status === "DONE" ? "Terminée" : t.status === "IN_PROGRESS" ? "En cours" : "À faire"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mes projets */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Avancement de mes projets</CardTitle>
          <CardDescription>Projets auxquels je contribue (apports ou tâches)</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.myProjects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="Aucun projet" description="Vous ne contribuez à aucun projet actuellement." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {stats.myProjects.map((p) => (
                <div key={p.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    <span className="text-xs font-bold text-primary">{p.phasesProgress}%</span>
                  </div>
                  <FundingBar value={p.phasesProgress} className="mb-2" />
                  <p className="text-[11px] text-muted-foreground">
                    Mon apport : <b className="text-foreground">{formatMoney(p.myContribution)}</b>
                    {p.myTasks.length > 0 && ` · ${p.myTasks.length} tâche(s)`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique paiements */}
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" /> Mes derniers paiements
          </CardTitle>
          <CardDescription>Historique de vos cotisations et reçus</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {stats.recentPayments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun paiement enregistré</p>
            ) : (
              stats.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`rounded-lg p-2 ${p.status === "VALIDATED" ? "bg-emerald-500/10 text-emerald-600" : p.status === "PENDING" ? "bg-amber-500/10 text-amber-600" : "bg-rose-500/10 text-rose-600"}`}>
                    <Wallet className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{p.campaign?.name ?? "Cotisation libre"}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(p.paidAt)}</p>
                  </div>
                  <MoneyText value={p.amount} className="text-sm font-semibold" />
                  <PaymentStatusBadge status={p.status} />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
