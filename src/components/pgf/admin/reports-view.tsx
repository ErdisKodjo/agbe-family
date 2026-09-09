"use client";
// ============================================================
// PGF — Rapports & Exports (PDF via impression, Excel/CSV, Word)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { get, downloadCSV, downloadWord } from "../api";
import type { ProjectRow, RegistryInfo } from "../types";
import { PageHeader, EmptyState } from "../shared/ui-bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { FileBarChart, FileSpreadsheet, FileText, Printer, Loader2, BookUser, BookOpen, Scale, Wallet, Gavel, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate, formatDateTime, formatDateLong } from "@/lib/format";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CAMPAIGN_TYPES } from "@/lib/constants";
import { monthLabel } from "@/lib/format";

type ReportType = "annuaire" | "grand-livre" | "balance" | "cotisations" | "projet" | "pv";
const CAT_LABELS: Record<string, string> = { ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES };

const REPORT_META: Record<ReportType, { title: string; desc: string; icon: any }> = {
  annuaire: { title: "Annuaire des membres", desc: "Liste des membres par registre et par localité", icon: BookUser },
  "grand-livre": { title: "Grand livre de trésorerie", desc: "Journal chronologique complet avec solde progressif", icon: BookOpen },
  balance: { title: "Balance comptable", desc: "Synthèse par catégorie : recettes et dépenses", icon: Scale },
  cotisations: { title: "État des cotisations", desc: "Retardataires vs à jour, toutes campagnes actives", icon: Wallet },
  projet: { title: "Rapport d'avancement projet", desc: "WBS, tâches et plan de financement", icon: FolderKanban },
  pv: { title: "PV de réunion (compte-rendu)", desc: "Généré automatiquement à partir des saisies des 30 derniers jours", icon: Gavel },
};

export function ReportsView() {
  const [type, setType] = useState<ReportType>("annuaire");
  const [registryId, setRegistryId] = useState("global");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState("");
  const [registries, setRegistries] = useState<RegistryInfo[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    get<{ registries: RegistryInfo[] }>("/api/registries").then((r) => setRegistries(r.registries)).catch(() => {});
    get<{ projects: ProjectRow[] }>("/api/projects").then((r) => setProjects(r.projects)).catch(() => {});
  }, []);

  useEffect(() => {
    if (type === "projet" && !projectId) return;
    const load = async () => {
      setLoading(true);
      setData(null);
      try {
        const params = new URLSearchParams({ type, registryId });
        if (projectId) params.set("projectId", projectId);
        const res = await get<any>(`/api/reports?${params}`);
        setData(res);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [type, registryId, projectId]);

  const meta = REPORT_META[type];

  // -------- Export CSV selon le type --------
  const exportCSV = () => {
    if (!data || data.type !== type) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (type === "annuaire") {
      const rows: (string | number)[][] = [
        ["ANNUAIRE DES MEMBRES", "", "", ""],
        ["Généré le", formatDateTime(data.generatedAt), "Total membres", data.total],
        [],
        ["Registre", "Nom", "Prénoms", "Téléphone", "Localité", "Position", "Rôle"],
        ...data.groups.flatMap((g: any) => g.list.map((m: any) => [g.registry, m.lastName, m.firstName, m.phone, m.city, m.position, m.role])),
      ];
      downloadCSV(`annuaire-${stamp}.csv`, rows);
    } else if (type === "grand-livre") {
      const rows: (string | number)[][] = [
        ["GRAND LIVRE DE TRÉSORERIE", "", ""],
        ["Généré le", formatDateTime(data.generatedAt), ""],
        [],
        ["Date", "Libellé", "Catégorie", "Registre", "Entrée (FCFA)", "Sortie (FCFA)", "Solde (FCFA)"],
        ...data.entries.map((e: any) => [
          formatDate(e.date),
          e.label,
          CAT_LABELS[e.category] ?? e.category,
          e.registry,
          e.type === "INCOME" ? e.amount : "",
          e.type === "EXPENSE" ? e.amount : "",
          e.balance,
        ]),
        ["", "TOTAUX", "", "", data.totalIncome, data.totalExpense, data.finalBalance],
      ];
      downloadCSV(`grand-livre-${stamp}.csv`, rows);
    } else if (type === "balance") {
      const rows: (string | number)[][] = [
        ["BALANCE COMPTABLE", "", ""],
        ["Généré le", formatDateTime(data.generatedAt), ""],
        [],
        ["RECETTES", "Montant (FCFA)", "Écritures"],
        ...data.incomes.map((i: any) => [CAT_LABELS[i.category] ?? i.category, i.amount, i.count]),
        ["TOTAL RECETTES", data.totalIncome, ""],
        [],
        ["DÉPENSES", "Montant (FCFA)", "Écritures"],
        ...data.expenses.map((i: any) => [CAT_LABELS[i.category] ?? i.category, i.amount, i.count]),
        ["TOTAL DÉPENSES", data.totalExpense, ""],
        [],
        ["SOLDE", data.balance, ""],
      ];
      downloadCSV(`balance-${stamp}.csv`, rows);
    } else if (type === "cotisations") {
      const rows: (string | number)[][] = [["ÉTAT DES COTISATIONS", "", ""], ["Généré le", formatDateTime(data.generatedAt), ""], []];
      data.campaigns.forEach((c: any) => {
        rows.push([c.campaign, "", "", "", ""], ["Membre", "Téléphone", "Dû (FCFA)", "Payé (FCFA)", "Statut"]);
        c.rows.forEach((r: any) => rows.push([r.member, r.phone, r.amountDue, r.amountPaid, r.status]));
        rows.push([`TOTAL ${c.campaign}`, "", c.expected, c.collected, ""], []);
      });
      downloadCSV(`etat-cotisations-${stamp}.csv`, rows);
    } else if (type === "projet" && data) {
      const rows: (string | number)[][] = [
        [`RAPPORT PROJET : ${data.project.name}`, "", ""],
        ["Budget", data.project.budget, "Collecté", data.financing.totalContributed],
        [],
        ["Phases (WBS)", "", ""],
        ["Phase", "Avancement (%)", "Statut"],
        ...data.phases.map((ph: any) => [ph.name, ph.progress, ph.status]),
        [],
        ["Financement par membre", "", ""],
        ["Membre", "Total (FCFA)", "Numéraire", "En nature"],
        ...data.financing.byMember.map((m: any) => [m.member, m.total, m.cash, m.inKind]),
      ];
      downloadCSV(`rapport-projet-${stamp}.csv`, rows);
    } else if (type === "pv") {
      const rows: (string | number)[][] = [
        ["PROCÈS-VERBAL DE RÉUNION", ""],
        ["Généré le", formatDateTime(data.generatedAt)],
        ["Période couverte", `du ${formatDate(data.periodStart)} au ${formatDate(new Date().toISOString())}`],
        [],
        ["Membres actifs", data.membersCount, "Nouveaux membres", data.newMembers],
        ["Recettes (30j)", data.treasury.income, "Dépenses (30j)", data.treasury.expense],
        [],
        ["Cotisations validées (30j)", data.contributions.totalValidated, "Montant", data.contributions.totalAmount],
        [],
        ["Membre", "Montant", "Campagne", "Date"],
        ...data.contributions.recent.map((c: any) => [c.member, c.amount, c.campaign, formatDate(c.date)]),
      ];
      downloadCSV(`pv-reunion-${stamp}.csv`, rows);
    }
    toast.success("Export Excel/CSV téléchargé");
  };

  // -------- Export Word --------
  const exportWord = () => {
    if (!data || data.type !== type) return;
    const stamp = new Date().toISOString().slice(0, 10);
    let html = "";
    if (type === "annuaire") {
      html = `<h1>Annuaire des membres</h1><p class="muted">Généré le ${formatDateTime(data.generatedAt)} — ${data.total} membres actifs</p>`;
      data.groups.forEach((g: any) => {
        html += `<h2>${g.registry} (${g.list.length} membres)</h2>
        <table><tr><th>Nom</th><th>Prénoms</th><th>Téléphone</th><th>Localité</th></tr>
        ${g.list.map((m: any) => `<tr><td>${m.lastName}</td><td>${m.firstName}</td><td>${m.phone}</td><td>${m.city}</td></tr>`).join("")}
        </table>`;
      });
    } else if (type === "grand-livre") {
      html = `<h1>Grand livre de trésorerie</h1>
      <p class="muted">Généré le ${formatDateTime(data.generatedAt)}</p>
      <table><tr><th>Date</th><th>Libellé</th><th>Recette</th><th>Dépense</th><th>Solde</th></tr>
      ${data.entries.map((e: any) => `<tr><td>${formatDate(e.date)}</td><td>${e.label}</td><td>${e.type === "INCOME" ? formatMoney(e.amount) : ""}</td><td>${e.type === "EXPENSE" ? formatMoney(e.amount) : ""}</td><td>${formatMoney(e.balance)}</td></tr>`).join("")}
      <tr class="total"><td>TOTAUX</td><td></td><td>${formatMoney(data.totalIncome)}</td><td>${formatMoney(data.totalExpense)}</td><td>${formatMoney(data.finalBalance)}</td></tr>
      </table>`;
    } else if (type === "balance") {
      html = `<h1>Balance comptable</h1><p class="muted">Généré le ${formatDateTime(data.generatedAt)}</p>
      <h2>Recettes</h2>
      <table><tr><th>Catégorie</th><th>Montant</th></tr>
      ${data.incomes.map((i: any) => `<tr><td>${CAT_LABELS[i.category] ?? i.category}</td><td>${formatMoney(i.amount)}</td></tr>`).join("")}
      <tr class="total"><td>Total recettes</td><td>${formatMoney(data.totalIncome)}</td></tr></table>
      <h2>Dépenses</h2>
      <table><tr><th>Catégorie</th><th>Montant</th></tr>
      ${data.expenses.map((i: any) => `<tr><td>${CAT_LABELS[i.category] ?? i.category}</td><td>${formatMoney(i.amount)}</td></tr>`).join("")}
      <tr class="total"><td>Total dépenses</td><td>${formatMoney(data.totalExpense)}</td></tr></table>
      <p><b>Solde : ${formatMoney(data.balance)}</b></p>`;
    } else if (type === "cotisations") {
      html = `<h1>État des cotisations</h1><p class="muted">Généré le ${formatDateTime(data.generatedAt)}</p>`;
      data.campaigns.forEach((c: any) => {
        html += `<h2>${c.campaign} — attendu ${formatMoney(c.expected)}, collecté ${formatMoney(c.collected)}</h2>
        <table><tr><th>Membre</th><th>Dû</th><th>Payé</th><th>Reste</th><th>Statut</th></tr>
        ${c.rows.map((r: any) => `<tr><td>${r.member}</td><td>${formatMoney(r.amountDue)}</td><td>${formatMoney(r.amountPaid)}</td><td>${formatMoney(r.rest)}</td><td>${r.status}</td></tr>`).join("")}
        </table>`;
      });
    } else if (type === "projet") {
      html = `<h1>Rapport d'avancement — ${data.project.name}</h1>
      <p class="muted">${data.project.description ?? ""}</p>
      <p><b>Budget :</b> ${formatMoney(data.project.budget)} · <b>Collecté :</b> ${formatMoney(data.financing.totalContributed)} (${data.financing.ratio}%) · <b>Statut :</b> ${data.project.status}</p>
      <h2>Phases (WBS)</h2>
      <table><tr><th>Phase</th><th>Avancement</th><th>Statut</th></tr>
      ${data.phases.map((ph: any) => `<tr><td>${ph.name}</td><td>${ph.progress}%</td><td>${ph.status}</td></tr>`).join("")}
      </table>
      <h2>Plan de financement (qui paie quoi)</h2>
      <table><tr><th>Membre</th><th>Numéraire</th><th>En nature</th><th>Total</th></tr>
      ${data.financing.byMember.map((m: any) => `<tr><td>${m.member}</td><td>${formatMoney(m.cash)}</td><td>${formatMoney(m.inKind)}</td><td>${formatMoney(m.total)}</td></tr>`).join("")}
      </table>`;
    } else if (type === "pv") {
      html = `<h1>Procès-verbal de réunion familiale</h1>
      <p class="muted">Généré le ${formatDateTime(data.generatedAt)} — synthèse des 30 derniers jours</p>
      <h2>1. Situation générale</h2>
      <p>La famille compte <b>${data.membersCount} membres actifs</b>, dont <b>${data.newMembers} nouveau(x)</b> sur la période. Le registre global reste à jour.</p>
      <h2>2. Situation financière</h2>
      <p>Recettes : <b>${formatMoney(data.treasury.income)}</b> · Dépenses : <b>${formatMoney(data.treasury.expense)}</b> · Solde : <b>${formatMoney(data.treasury.balance)}</b></p>
      <h2>3. Cotisations</h2>
      <p>${data.contributions.totalValidated} paiement(s) validé(s) pour un total de <b>${formatMoney(data.contributions.totalAmount)}</b> ; ${data.contributions.pending} déclaration(s) en attente de validation.</p>
      ${data.contributions.recent.length ? `<table><tr><th>Membre</th><th>Montant</th><th>Campagne</th></tr>${data.contributions.recent.map((c: any) => `<tr><td>${c.member}</td><td>${formatMoney(c.amount)}</td><td>${c.campaign}</td></tr>`).join("")}</table>` : ""}
      <h2>4. Projets</h2>
      ${data.projects.length ? `<table><tr><th>Projet</th><th>Avancement</th><th>Budget</th></tr>${data.projects.map((p: any) => `<tr><td>${p.name}</td><td>${p.progress}%</td><td>${formatMoney(p.budget)}</td></tr>`).join("")}</table>` : "<p>Aucun projet actif sur la période.</p>"}
      <h2>5. Décisions et actions récentes</h2>
      ${data.actions.length ? `<table><tr><th>Qui</th><th>Action</th><th>Détail</th></tr>${data.actions.map((a: any) => `<tr><td>${a.who}</td><td>${a.action}</td><td>${a.details ?? ""}</td></tr>`).join("")}</table>` : "<p>Aucune action notable.</p>"}`;
    }
    const titles: Record<ReportType, string> = {
      annuaire: "Annuaire des membres",
      "grand-livre": "Grand livre de trésorerie",
      balance: "Balance comptable",
      cotisations: "État des cotisations",
      projet: "Rapport de projet",
      pv: "Procès-verbal de réunion",
    };
    downloadWord(`${type}-${stamp}.doc`, titles[type], html);
    toast.success("Document Word téléchargé");
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="pgf-no-print">
        <PageHeader
          icon={FileBarChart}
          title="Rapports & Exports"
          description="Documents officiels pour les assemblées générales : PDF, Excel (CSV) et Word."
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {(Object.keys(REPORT_META) as ReportType[]).map((t) => {
            const ReportIcon = REPORT_META[t].icon;
            return (
            <button
              key={t}
              onClick={() => {
                setType(t);
                if (t !== "projet") setProjectId("");
              }}
              className={`rounded-xl border p-3.5 text-left transition-all ${
                type === t ? "border-primary bg-primary/5 shadow-sm" : "bg-card hover:border-primary/40 hover:shadow-sm"
              }`}
            >
              <ReportIcon className={`w-5 h-5 mb-2 ${type === t ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-[13px] font-semibold leading-tight">{REPORT_META[t].title}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug line-clamp-2">{REPORT_META[t].desc}</p>
            </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mt-1">
          <div className="flex gap-2 flex-wrap">
            {type !== "pv" && type !== "projet" && (
              <Select value={registryId} onValueChange={setRegistryId}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Tous les registres</SelectItem>
                  {registries.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {type === "projet" && (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choisir un projet…" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data}>
              <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel / CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportWord} disabled={!data}>
              <FileText className="w-4 h-4 mr-1.5" /> Word
            </Button>
            <Button size="sm" onClick={printReport} disabled={!data}>
              <Printer className="w-4 h-4 mr-1.5" /> PDF (Imprimer)
            </Button>
          </div>
        </div>
      </div>

      {/* ---------- Zone imprimable ---------- */}
      <div className="pgf-print-area bg-card rounded-xl border border-border/70 min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-3" /> Génération du rapport…
          </div>
        ) : !data || data.type !== type ? (
          <EmptyState
            icon={FileBarChart}
            title={type === "projet" ? "Sélectionnez un projet" : "Rapport vide"}
            description={type === "projet" ? "Choisissez le projet à rapporter dans la liste ci-dessus." : "Aucune donnée disponible pour ce rapport."}
          />
        ) : (
          <div className="p-6 sm:p-8 max-w-4xl mx-auto">
            <ReportHeader type={type} data={data} />
            <ReportBody type={type} data={data} />
          </div>
        )}
      </div>
    </div>
  );
}

function ReportHeader({ type, data }: { type: ReportType; data: any }) {
  return (
    <div className="border-b-2 border-primary pb-4 mb-6 flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">AGBE Family — Plateforme de Gestion Familiale</p>
        <h2 className="text-2xl font-bold tracking-tight mt-1.5">{REPORT_META[type].title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{REPORT_META[type].desc}</p>
      </div>
      <div className="text-right text-xs text-muted-foreground shrink-0 pt-1">
        <p className="font-semibold text-foreground">{formatDateLong(data.generatedAt)}</p>
        <p>Document officiel</p>
      </div>
    </div>
  );
}

function ReportBody({ type, data }: { type: ReportType; data: any }) {
  if (type === "annuaire") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-xl font-bold">{data.total}</p>
            <p className="text-xs text-muted-foreground">membres actifs</p>
          </div>
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-xl font-bold">{data.groups.length}</p>
            <p className="text-xs text-muted-foreground">registres</p>
          </div>
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-xl font-bold">{data.cities.length}</p>
            <p className="text-xs text-muted-foreground">localités</p>
          </div>
        </div>
        {data.groups.map((g: any) => (
          <div key={g.registry}>
            <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
              {g.registry} <Badge variant="outline">{g.list.length}</Badge>
            </h3>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead>Nom & Prénoms</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Localité</TableHead>
                    <TableHead className="hidden sm:table-cell">Position</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.list.map((m: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">
                        {m.lastName} {m.firstName}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{m.phone}</TableCell>
                      <TableCell className="text-sm">{m.city}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{m.position}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
        <div>
          <h3 className="font-bold text-primary mb-2">Répartition par localité</h3>
          <div className="flex flex-wrap gap-2">
            {data.cities.map((c: any) => (
              <Badge key={c.city} variant="secondary" className="text-xs">
                {c.city} : {c.count}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "grand-livre") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-emerald-500/10 p-3">
            <p className="text-lg font-bold text-emerald-700">{formatMoney(data.totalIncome)}</p>
            <p className="text-xs text-emerald-700/80">total recettes</p>
          </div>
          <div className="rounded-lg bg-rose-500/10 p-3">
            <p className="text-lg font-bold text-rose-700">{formatMoney(data.totalExpense)}</p>
            <p className="text-xs text-rose-700/80">total dépenses</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <p className="text-lg font-bold text-primary">{formatMoney(data.finalBalance)}</p>
            <p className="text-xs text-primary/80">solde final</p>
          </div>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead className="w-24">Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                <TableHead className="text-right">Entrée</TableHead>
                <TableHead className="text-right">Sortie</TableHead>
                <TableHead className="text-right">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.map((e: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(e.date)}</TableCell>
                  <TableCell className="text-sm font-medium">{e.label}</TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{CAT_LABELS[e.category] ?? e.category}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-emerald-600">{e.type === "INCOME" ? formatMoney(e.amount) : ""}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-rose-600">{e.type === "EXPENSE" ? formatMoney(e.amount) : ""}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">{formatMoney(e.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (type === "balance") {
    return (
      <div className="space-y-6">
        {[
          { title: "Recettes par catégorie", items: data.incomes, total: data.totalIncome, tone: "text-emerald-700" },
          { title: "Dépenses par catégorie", items: data.expenses, total: data.totalExpense, tone: "text-rose-700" },
        ].map((section) => (
          <div key={section.title}>
            <h3 className="font-bold text-primary mb-2">{section.title}</h3>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Écritures</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.items.map((i: any) => (
                    <TableRow key={i.category}>
                      <TableCell className="text-sm font-medium">{CAT_LABELS[i.category] ?? i.category}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{i.count}</TableCell>
                      <TableCell className={`text-right text-sm font-semibold tabular-nums ${section.tone}`}>{formatMoney(i.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-secondary/40 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell />
                    <TableCell className={`text-right tabular-nums ${section.tone}`}>{formatMoney(section.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
        <div className="rounded-xl border-2 border-primary p-4 flex justify-between items-center">
          <span className="font-bold">SOLDE DE TRÉSORERIE</span>
          <span className="text-xl font-bold text-primary tabular-nums">{formatMoney(data.balance)}</span>
        </div>
      </div>
    );
  }

  if (type === "cotisations") {
    return (
      <div className="space-y-6">
        {data.campaigns.map((c: any, idx: number) => {
          const upToDate = c.rows.filter((r: any) => r.status === "À jour").length;
          return (
            <div key={idx}>
              <h3 className="font-bold text-primary flex items-center gap-2 flex-wrap">
                {c.campaign}
                {c.type === CAMPAIGN_TYPES.MONTHLY && c.periodMonth && (
                  <Badge variant="outline" className="font-normal">
                    {monthLabel(c.periodMonth)} {c.periodYear}
                  </Badge>
                )}
                <Badge variant="outline" className="font-normal">
                  {upToDate}/{c.rows.length} à jour
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                Attendu : {formatMoney(c.expected)} · Collecté : {formatMoney(c.collected)}
              </p>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead>Membre</TableHead>
                      <TableHead className="text-right">Dû</TableHead>
                      <TableHead className="text-right">Payé</TableHead>
                      <TableHead className="text-right">Reste</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.rows.map((r: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium">{r.member}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatMoney(r.amountDue)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatMoney(r.amountPaid)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-semibold">{r.rest > 0 ? formatMoney(r.rest) : "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              r.status === "À jour"
                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                                : r.status === "Partiel"
                                ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                                : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                            }
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
        {data.campaigns.length === 0 && <EmptyState icon={Wallet} title="Aucune campagne active" />}
      </div>
    );
  }

  if (type === "projet") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-base font-bold">{formatMoney(data.project.budget)}</p>
            <p className="text-xs text-muted-foreground">budget requis</p>
          </div>
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-base font-bold text-primary">{formatMoney(data.financing.totalContributed)}</p>
            <p className="text-xs text-muted-foreground">collecté ({data.financing.ratio}%)</p>
          </div>
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-base font-bold">{formatMoney(data.financing.cash)}</p>
            <p className="text-xs text-muted-foreground">numéraire</p>
          </div>
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-base font-bold text-amber-700">{formatMoney(data.financing.inKind)}</p>
            <p className="text-xs text-muted-foreground">en nature</p>
          </div>
        </div>
        {data.project.description && <p className="text-sm text-muted-foreground">{data.project.description}</p>}
        <div>
          <h3 className="font-bold text-primary mb-2">Avancement des phases (WBS)</h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Phase</TableHead>
                  <TableHead className="w-40">Avancement</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.phases.map((ph: any) => (
                  <TableRow key={ph.name}>
                    <TableCell className="text-sm font-medium">{ph.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${ph.progress}%` }} />
                        </div>
                        <span className="text-xs tabular-nums font-semibold">{ph.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ph.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div>
          <h3 className="font-bold text-primary mb-2">Plan de financement — qui paie quoi</h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Membre</TableHead>
                  <TableHead className="text-right">Numéraire</TableHead>
                  <TableHead className="text-right">En nature</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.financing.byMember.map((m: any) => (
                  <TableRow key={m.member}>
                    <TableCell className="text-sm font-medium">{m.member}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatMoney(m.cash)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatMoney(m.inKind)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">{formatMoney(m.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  }

  // PV
  return (
    <div className="space-y-5 text-sm">
      <p className="text-muted-foreground">
        Procès-verbal généré automatiquement le <b className="text-foreground">{formatDateTime(data.generatedAt)}</b>, couvrant la période du{" "}
        <b className="text-foreground">{formatDate(data.periodStart)}</b> au <b className="text-foreground">{formatDate(new Date())}</b> à partir des saisies de la plateforme.
      </p>
      <section>
        <h3 className="font-bold text-primary mb-1.5">1. Situation des membres</h3>
        <p>
          Le Registre Global compte <b>{data.membersCount} membres actifs</b>, dont <b>{data.newMembers}</b> nouveau(x) membre(s) enrôlé(s) sur la période.
        </p>
      </section>
      <section>
        <h3 className="font-bold text-primary mb-1.5">2. Situation de trésorerie</h3>
        <p>
          Recettes encaissées : <b className="text-emerald-700">{formatMoney(data.treasury.income)}</b> · Dépenses engagées :{" "}
          <b className="text-rose-700">{formatMoney(data.treasury.expense)}</b> · Solde de caisse : <b>{formatMoney(data.treasury.balance)}</b>
        </p>
      </section>
      <section>
        <h3 className="font-bold text-primary mb-1.5">3. Cotisations</h3>
        <p>
          <b>{data.contributions.totalValidated}</b> paiement(s) validé(s) pour <b>{formatMoney(data.contributions.totalAmount)}</b> ;{" "}
          <b>{data.contributions.pending}</b> déclaration(s) en attente de validation.
        </p>
        {data.contributions.recent.length > 0 && (
          <div className="mt-3 rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Membre</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Campagne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.contributions.recent.map((c: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{c.member}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatMoney(c.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.campaign}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
      <section>
        <h3 className="font-bold text-primary mb-1.5">4. Projets en cours</h3>
        {data.projects.length > 0 ? (
          <ul className="space-y-1.5">
            {data.projects.map((p: any) => (
              <li key={p.name} className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <Badge variant="outline" className="text-xs">{p.progress}%</Badge>
                <span className="text-muted-foreground text-xs">({formatMoney(p.budget)})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Aucun projet actif sur la période.</p>
        )}
      </section>
      <section>
        <h3 className="font-bold text-primary mb-1.5">5. Actions notables</h3>
        <ul className="space-y-1">
          {data.actions.slice(0, 10).map((a: any, i: number) => (
            <li key={i} className="text-xs text-muted-foreground">
              • <b className="text-foreground">{a.who}</b> — {a.details ?? `${a.action} ${a.entity}`}
            </li>
          ))}
        </ul>
      </section>
      <p className="border-t pt-4 text-xs text-muted-foreground">
        Fait par la plateforme PGF · Document généré automatiquement pour l'assemblée générale.
      </p>
    </div>
  );
}
