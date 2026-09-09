"use client";
// ============================================================
// PGF — Module Projets (fiche, WBS, tâches, financement)
// ============================================================
import { useEffect, useState } from "react";
import { get, post, patch, del } from "../api";
import type { ProjectRow, RegistryInfo, MemberRow, PhaseRow } from "../types";
import { PageHeader, MemberAvatar, FundingBar, EmptyState, MoneyText, StatCard } from "../shared/ui-bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderKanban,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Layers,
  Users2,
  Coins,
  CalendarDays,
  ChevronRight,
  Download,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, PHASE_STATUS_LABELS, CONTRIBUTION_KINDS, CONTRIBUTION_KIND_LABELS } from "@/lib/constants";
import { downloadCSV } from "../api";

const STATUS_TONES: Record<string, string> = {
  PLANNED: "bg-secondary text-secondary-foreground",
  IN_PROGRESS: "bg-amber-500/90 text-white",
  COMPLETED: "bg-emerald-600 text-white",
  CANCELLED: "bg-rose-500/90 text-white",
};

export function ProjectsView() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [registries, setRegistries] = useState<RegistryInfo[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProjectRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProjectRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [phaseDialog, setPhaseDialog] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  const [contribDialog, setContribDialog] = useState(false);
  const [phaseForm, setPhaseForm] = useState({ name: "", budget: "" });
  const [taskForm, setTaskForm] = useState<any>({ title: "", description: "", assigneeId: "", phaseId: "", dueDate: "" });
  const [contribForm, setContribForm] = useState<any>({ memberId: "", amount: "", kind: "CASH", description: "", date: "" });
  const [form, setForm] = useState<any>({
    name: "",
    description: "",
    registryId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    budget: 0,
    status: "PLANNED",
    phasesText: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [projs, regs, mems] = await Promise.all([
        get<{ projects: ProjectRow[] }>("/api/projects"),
        get<{ registries: RegistryInfo[] }>("/api/registries"),
        get<{ members: MemberRow[] }>("/api/members"),
      ]);
      setProjects(projs.projects);
      setRegistries(regs.registries);
      setMembers(mems.members);
      if (selected) {
        const refresh = projs.projects.find((p) => p.id === selected.id);
        setSelected(refresh ?? null);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({
      name: "",
      description: "",
      registryId: registries[0]?.id ?? "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      budget: 0,
      status: "PLANNED",
      phasesText: "",
    });
    setCreateOpen(true);
  };

  const saveProject = async () => {
    if (!form.name.trim()) {
      toast.error("Nom du projet requis");
      return;
    }
    setSaving(true);
    try {
      await post("/api/projects", {
        name: form.name,
        description: form.description,
        registryId: form.registryId,
        startDate: form.startDate,
        endDate: form.endDate || null,
        budget: Number(form.budget),
        status: form.status,
        phases: form.phasesText
          .split("\n")
          .map((s: string) => s.trim())
          .filter(Boolean)
          .map((name: string) => ({ name })),
      });
      toast.success("Projet créé");
      setCreateOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeProject = async () => {
    if (!deleting) return;
    try {
      await del(`/api/projects/${deleting.id}`);
      toast.success("Projet supprimé");
      setDeleting(null);
      if (selected?.id === deleting.id) setSelected(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ---------- Détail projet ----------
  const renderDetail = (p: ProjectRow) => {
    const addPhase = async () => {
      if (!phaseForm.name.trim()) return;
      try {
        await post(`/api/projects/${p.id}/phases`, { name: phaseForm.name, budget: phaseForm.budget ? Number(phaseForm.budget) : null });
        toast.success("Phase ajoutée");
        setPhaseDialog(false);
        setPhaseForm({ name: "", budget: "" });
        load();
      } catch (e: any) {
        toast.error(e.message);
      }
    };

    const addTask = async () => {
      if (!taskForm.title.trim()) return;
      try {
        await post(`/api/projects/${p.id}/tasks`, taskForm);
        toast.success("Tâche assignée");
        setTaskDialog(false);
        setTaskForm({ title: "", description: "", assigneeId: "", phaseId: "", dueDate: "" });
        load();
      } catch (e: any) {
        toast.error(e.message);
      }
    };

    const addContrib = async () => {
      if (!contribForm.memberId || !contribForm.amount) {
        toast.error("Membre et montant requis");
        return;
      }
      try {
        await post(`/api/projects/${p.id}/contributions`, contribForm);
        toast.success("Apport enregistré" + (contribForm.kind === "CASH" ? " — trésorerie créditée" : ""));
        setContribDialog(false);
        setContribForm({ memberId: "", amount: "", kind: "CASH", description: "", date: "" });
        load();
      } catch (e: any) {
        toast.error(e.message);
      }
    };

    const updatePhase = async (phase: PhaseRow, progress: number) => {
      try {
        await patch(`/api/phases/${phase.id}`, { progress });
        load();
      } catch (e: any) {
        toast.error(e.message);
      }
    };

    const updateTaskStatus = async (taskId: string, status: string) => {
      try {
        await patch(`/api/tasks/${taskId}`, { status });
        load();
      } catch (e: any) {
        toast.error(e.message);
      }
    };

    const exportProject = () => {
      const rows: (string | number)[][] = [
        [`PROJET : ${p.name}`, "", "", ""],
        [`Budget : ${p.budget} FCFA`, "", `Collecté : ${p.totalContributed} FCFA`, `Avancement : ${p.phasesProgress}%`],
        [],
        ["PHASES (WBS)", "", "", ""],
        ["Phase", "Avancement (%)", "Statut", "Budget (FCFA)"],
        ...p.phases.map((ph) => [ph.name, ph.progress, PHASE_STATUS_LABELS[ph.status] ?? ph.status, ph.budget ?? "—"]),
        [],
        ["TÂCHES (qui fait quoi)", "", "", ""],
        ["Tâche", "Assigné à", "Phase", "Statut"],
        ...p.tasks.map((t) => [
          t.title,
          t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "—",
          t.phase?.name ?? "—",
          TASK_STATUS_LABELS[t.status] ?? t.status,
        ]),
        [],
        ["FINANCEMENT (qui paie quoi)", "", "", ""],
        ["Membre", "Total (FCFA)", "Numéraire", "En nature"],
        ...p.contributionsByMember.map((c) => [
          `${c.member.lastName} ${c.member.firstName}`,
          c.total,
          c.cash,
          c.inKind,
        ]),
      ];
      downloadCSV(`rapport-projet-${p.name.replace(/\s+/g, "-").toLowerCase()}.csv`, rows);
      toast.success("Rapport projet exporté");
    };

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-1">
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Tous les projets
        </Button>

        <Card className="border-border/70">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight">{p.name}</h2>
                  <Badge className={STATUS_TONES[p.status]}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
                  <Badge variant="outline" className="font-normal">
                    {p.registry.name}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{p.description || "Aucune description"}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {formatDate(p.startDate)} → {p.endDate ? formatDate(p.endDate) : "en cours"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportProject}>
                  <Download className="w-4 h-4 mr-1.5" /> Rapport
                </Button>
                <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => setDeleting(p)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs projet */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard title="Budget requis" value={formatMoney(p.budget)} icon={FolderKanban} />
          <StatCard title="Apports collectés" value={formatMoney(p.totalContributed)} icon={Coins} tone="gold" hint={`${p.fundingRatio}% du budget`} />
          <StatCard title="Avancement global" value={`${p.phasesProgress}%`} icon={Layers} hint={`${p.phases.length} phases`} />
          <StatCard title="Tâches" value={`${p.tasks.filter((t) => t.status === "DONE").length}/${p.tasks.length}`} icon={Users2} tone="neutral" />
        </div>

        <Tabs defaultValue="phases">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
            <TabsTrigger value="phases">Phases (WBS)</TabsTrigger>
            <TabsTrigger value="tasks">Tâches — qui fait quoi</TabsTrigger>
            <TabsTrigger value="funding">Financement — qui paie quoi</TabsTrigger>
          </TabsList>

          {/* ---- Phases ---- */}
          <TabsContent value="phases" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setPhaseDialog(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Ajouter une phase
              </Button>
            </div>
            {p.phases.length === 0 ? (
              <EmptyState icon={Layers} title="Aucune phase" description="Découpez le projet : Terrain, Fondations, Murs, Toiture…" />
            ) : (
              p.phases.map((ph) => (
                <Card key={ph.id} className="border-border/70">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="rounded-lg bg-primary/10 text-primary w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">
                          {ph.position + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{ph.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {PHASE_STATUS_LABELS[ph.status]}
                            {ph.budget ? ` · Budget ${formatMoney(ph.budget)}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-auto sm:ml-4 tabular-nums shrink-0">
                          {ph.progress}%
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-rose-600 h-8 w-8 shrink-0"
                          onClick={async () => {
                            await del(`/api/phases/${ph.id}`);
                            load();
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="w-full sm:w-64 space-y-2">
                        <Slider value={[ph.progress]} max={100} step={5} onValueChange={([v]) => updatePhase(ph, v)} />
                        <Progress value={ph.progress} className="h-1.5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ---- Tâches ---- */}
          <TabsContent value="tasks" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setTaskDialog(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Assigner une tâche
              </Button>
            </div>
            {p.tasks.length === 0 ? (
              <EmptyState icon={Users2} title="Aucune tâche" description="Assignez les responsabilités : « Paul gère les artisans »…" />
            ) : (
              <Card className="border-border/70 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                        <TableHead className="min-w-[200px]">Tâche</TableHead>
                        <TableHead>Assignée à</TableHead>
                        <TableHead className="hidden md:table-cell">Phase</TableHead>
                        <TableHead className="hidden sm:table-cell">Échéance</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.tasks.map((t) => (
                        <TableRow key={t.id} className="hover:bg-secondary/30">
                          <TableCell>
                            <p className="text-sm font-medium">{t.title}</p>
                            {t.description && <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>}
                          </TableCell>
                          <TableCell>
                            {t.assignee ? (
                              <div className="flex items-center gap-2">
                                <MemberAvatar firstName={t.assignee.firstName} lastName={t.assignee.lastName} size="sm" />
                                <span className="text-sm">
                                  {t.assignee.firstName} {t.assignee.lastName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Non assignée</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{t.phase?.name ?? "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {t.dueDate ? formatDate(t.dueDate) : "—"}
                          </TableCell>
                          <TableCell>
                            <Select value={t.status} onValueChange={(v) => updateTaskStatus(t.id, v)}>
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
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-600"
                              onClick={async () => {
                                await del(`/api/tasks/${t.id}`);
                                load();
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ---- Financement ---- */}
          <TabsContent value="funding" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setContribDialog(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Enregistrer un apport
              </Button>
            </div>
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Plan de financement</CardTitle>
                <CardDescription>
                  Apports spécifiques au projet (distincts des cotisations mensuelles) — {formatMoney(p.totalContributed)} collectés
                  {p.budget > 0 ? ` sur ${formatMoney(p.budget)}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Couverture du budget</span>
                    <span className="font-semibold">{p.fundingRatio}%</span>
                  </div>
                  <FundingBar value={p.fundingRatio} className="h-3" />
                </div>
                {p.contributionsByMember.length === 0 ? (
                  <EmptyState icon={Coins} title="Aucun apport" description="Enregistrez les apports des membres (numéraire ou en nature)." />
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                          <TableHead>Membre</TableHead>
                          <TableHead className="text-right">Numéraire</TableHead>
                          <TableHead className="text-right">En nature</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.contributionsByMember.map((c) => (
                          <TableRow key={c.member.id}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <MemberAvatar firstName={c.member.firstName} lastName={c.member.lastName} size="sm" />
                                <span className="text-sm font-medium">
                                  {c.member.lastName} {c.member.firstName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{formatMoney(c.cash)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-amber-700">{formatMoney(c.inKind)}</TableCell>
                            <TableCell className="text-right">
                              <MoneyText value={c.total} className="text-sm font-semibold" />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-rose-600"
                                onClick={async () => {
                                  await del(`/api/projects/${p.id}/contributions?contributionId=${c.member.contributionId ?? ""}`);
                                  load();
                                }}
                                style={{ display: "none" }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {/* Détail des apports */}
                {p.contributions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Détail des apports</p>
                    <div className="max-h-48 overflow-y-auto pgf-scroll space-y-1.5">
                      {p.contributions.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                          <Badge variant="outline" className={c.kind === "CASH" ? "text-emerald-700" : "text-amber-700"}>
                            {CONTRIBUTION_KIND_LABELS[c.kind]}
                          </Badge>
                          <span className="text-sm font-medium">
                            {c.member.lastName} {c.member.firstName}
                          </span>
                          <span className="text-sm text-muted-foreground truncate flex-1 hidden sm:block">
                            {c.description ?? "—"}
                          </span>
                          <span className="text-sm font-semibold tabular-nums ml-auto">{formatMoney(c.amount)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-600"
                            onClick={async () => {
                              await del(`/api/projects/${p.id}/contributions?contributionId=${c.id}`);
                              load();
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ---- Dialogs du détail ---- */}
        <Dialog open={phaseDialog} onOpenChange={setPhaseDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Nouvelle phase</DialogTitle>
              <DialogDescription>Ex : Terrain, Fondations, Murs, Toiture, Finitions…</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom de la phase *</Label>
                <Input value={phaseForm.name} onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Budget de la phase (FCFA) — optionnel</Label>
                <Input type="number" min={0} value={phaseForm.budget} onChange={(e) => setPhaseForm({ ...phaseForm, budget: e.target.value })} className="tabular-nums" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPhaseDialog(false)}>
                Annuler
              </Button>
              <Button onClick={addPhase}>Ajouter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Assigner une tâche</DialogTitle>
              <DialogDescription>Qui fait quoi ? La personne assignée peut mettre à jour le statut depuis son espace.</DialogDescription>
            </DialogHeader>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Intitulé *</Label>
                <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Achat ciment — 20 sacs" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Assigner à</Label>
                <Select value={taskForm.assigneeId} onValueChange={(v) => setTaskForm({ ...taskForm, assigneeId: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un membre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Personne —</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.lastName} {m.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select value={taskForm.phaseId} onValueChange={(v) => setTaskForm({ ...taskForm, phaseId: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucune —</SelectItem>
                    {p.phases.map((ph) => (
                      <SelectItem key={ph.id} value={ph.id}>
                        {ph.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Échéance</Label>
                <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTaskDialog(false)}>
                Annuler
              </Button>
              <Button onClick={addTask}>Assigner</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={contribDialog} onOpenChange={setContribDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enregistrer un apport</DialogTitle>
              <DialogDescription>
                « Qui paie quoi » — les apports en numéraire alimentent automatiquement la trésorerie.
              </DialogDescription>
            </DialogHeader>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Membre *</Label>
                <Select value={contribForm.memberId} onValueChange={(v) => setContribForm({ ...contribForm, memberId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un membre" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.lastName} {m.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Montant estimé (FCFA) *</Label>
                <Input type="number" min={0} value={contribForm.amount} onChange={(e) => setContribForm({ ...contribForm, amount: e.target.value })} className="tabular-nums" />
              </div>
              <div className="space-y-2">
                <Label>Nature de l'apport</Label>
                <Select value={contribForm.kind} onValueChange={(v) => setContribForm({ ...contribForm, kind: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Numéraire</SelectItem>
                    <SelectItem value="IN_KIND">En nature</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Input value={contribForm.description} onChange={(e) => setContribForm({ ...contribForm, description: e.target.value })} placeholder="Ex : 10 sacs de ciment + transport" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setContribDialog(false)}>
                Annuler
              </Button>
              <Button onClick={addContrib}>Enregistrer l'apport</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // ---------- Liste projets ----------
  if (selected) return renderDetail(selected);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FolderKanban}
        title="Projets & Chantiers"
        description="Projets d'investissement et événementiels : construction, mariage, business familial."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" /> Nouveau projet
          </Button>
        }
      />

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="h-52 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Aucun projet" description="Créez votre premier projet : « Construction Puits de Village »…" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="border-border/70 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer"
              onClick={() => setSelected(p)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-primary/10 text-primary p-2.5 shrink-0">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <Badge className={STATUS_TONES[p.status]}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
                </div>
                <h3 className="font-bold mt-3 truncate">{p.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[32px]">{p.description || "Aucune description"}</p>

                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div>
                    <p className="text-sm font-bold tabular-nums">{formatMoney(p.budget)}</p>
                    <p className="text-[10px] text-muted-foreground">budget</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold tabular-nums text-primary">{formatMoney(p.totalContributed)}</p>
                    <p className="text-[10px] text-muted-foreground">collecté</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold tabular-nums">{p.phasesProgress}%</p>
                    <p className="text-[10px] text-muted-foreground">avancement</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <FundingBar value={p.fundingRatio} />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" /> {p.phases.length} phases
                    </span>
                    <span className="flex items-center gap-1">
                      <Users2 className="w-3 h-3" /> {p.contributionsByMember.length} contributeurs
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ---- Dialog création projet ---- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto pgf-scroll">
          <DialogHeader>
            <DialogTitle>Nouveau projet</DialogTitle>
            <DialogDescription>Fiche projet : nom, budget requis et découpage en phases.</DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nom du projet *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Construction Puits de Village" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Forage d'un puits moderne pour le village d'Agbélouvé…" />
            </div>
            <div className="space-y-2">
              <Label>Registre *</Label>
              <Select value={form.registryId} onValueChange={(v) => setForm({ ...form, registryId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {registries.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Budget total requis (FCFA)</Label>
              <Input type="number" min={0} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>Date de début</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date de fin prévue</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Phases (une par ligne) — optionnel</Label>
              <Textarea value={form.phasesText} onChange={(e) => setForm({ ...form, phasesText: e.target.value })} rows={4} placeholder={"Étude & Terrain\nForage\nPompe & Équipement\nClôture"} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveProject} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer le projet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Phases, tâches et apports rattachés seront supprimés définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={removeProject} className="bg-rose-600 hover:bg-rose-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
