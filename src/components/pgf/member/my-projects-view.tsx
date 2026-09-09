"use client";
// ============================================================
// PGF — Mes projets (espace membre) : avancement + mes tâches
// ============================================================
import { useEffect, useState } from "react";
import { get, patch } from "../api";
import type { ProjectRow } from "../types";
import { PageHeader, FundingBar, EmptyState, MoneyText, StatCard } from "../shared/ui-bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderKanban, ListChecks, Coins, Layers, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { PROJECT_STATUS_LABELS, TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";

export function MyProjectsView() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await get<{ projects: ProjectRow[] }>("/api/projects?mine=1");
      setProjects(res.projects);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateTask = async (taskId: string, status: string) => {
    try {
      await patch(`/api/tasks/${taskId}`, { status });
      toast.success("Statut de la tâche mis à jour");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const totalContributed = projects.reduce((s, p) => s + p.myContribution, 0);
  const myOpenTasks = projects.reduce((s, p) => s + p.myTasks.filter((t) => t.status !== "DONE").length, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FolderKanban}
        title="Mes projets"
        description="Les chantiers auxquels vous contribuez, vos apports et vos tâches."
      />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard title="Projets suivis" value={`${projects.length}`} icon={FolderKanban} />
        <StatCard title="Mes apports cumulés" value={formatMoney(totalContributed)} icon={Coins} tone="gold" />
        <StatCard title="Tâches ouvertes" value={`${myOpenTasks}`} icon={ListChecks} tone="neutral" />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="h-44 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Aucun projet" description="Vous ne contribuez à aucun projet pour l'instant. La tête de liste peut vous assigner des tâches ou des apports." />
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <Card key={p.id} className="border-border/70">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <Badge variant="outline" className="font-normal">
                    {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                </div>
                <CardDescription>{p.description || "Aucune description"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Avancement global</span>
                      <span className="font-semibold">{p.phasesProgress}%</span>
                    </div>
                    <FundingBar value={p.phasesProgress} />
                    <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> {p.phases.length} phases · {p.phases.filter((ph) => ph.status === "DONE").length} terminées
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Financement</span>
                      <span className="font-semibold">{p.fundingRatio}%</span>
                    </div>
                    <FundingBar value={p.fundingRatio} />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Collecté : <MoneyText value={p.totalContributed} className="font-semibold" /> sur {formatMoney(p.budget)}
                    </p>
                  </div>
                </div>

                {/* Mon implication */}
                <div className="rounded-xl border bg-secondary/30 p-4 space-y-3">
                  <p className="text-sm font-semibold">Mon implication</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Coins className="w-4 h-4 text-amber-600" />
                    Mon apport : <b className="text-foreground">{formatMoney(p.myContribution)}</b>
                    <span className="text-muted-foreground">sur {formatMoney(p.totalContributed)} collectés</span>
                  </div>
                  {p.myTasks.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                        <ListChecks className="w-3.5 h-3.5" /> Mes tâches
                      </p>
                      {p.myTasks.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 rounded-lg bg-card border px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{t.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {t.phase?.name ?? "Général"}
                              {t.dueDate ? ` · échéance ${formatDate(t.dueDate)}` : ""}
                            </p>
                          </div>
                          <Select value={t.status} onValueChange={(v) => updateTask(t.id, v)}>
                            <SelectTrigger className="h-8 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(TASK_STATUSES).map(([k, v]) => (
                                <SelectItem key={k} value={k}>
                                  {TASK_STATUS_LABELS[v]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {t.status === "DONE" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
