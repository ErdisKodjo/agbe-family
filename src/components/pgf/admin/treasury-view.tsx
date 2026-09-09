"use client";
// ============================================================
// PGF — Module Trésorerie (journal de caisse)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { get, post, patch, del } from "../api";
import type { TransactionRow, RegistryInfo } from "../types";
import { PageHeader, StatCard, MoneyText, EmptyState } from "../shared/ui-bits";
import { ProofUpload } from "../shared/proof-upload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Landmark,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Paperclip,
  MoreHorizontal,
  Pencil,
  Download,
  Loader2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import { downloadCSV } from "../api";

const CAT_LABELS: Record<string, string> = { ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES };

export function TreasuryView() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [balance, setBalance] = useState({ totalIncome: 0, totalExpense: 0, current: 0 });
  const [registries, setRegistries] = useState<RegistryInfo[]>([]);
  const [registryId, setRegistryId] = useState("global");
  const [filterType, setFilterType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [deleting, setDeleting] = useState<TransactionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    type: "EXPENSE",
    label: "",
    category: "ACHAT_MATERIEL",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    registryId: "",
    attachmentUrl: null,
    note: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [txs, regs] = await Promise.all([
        get<{ transactions: TransactionRow[]; balance: any }>(`/api/transactions?registryId=${registryId}`),
        get<{ registries: RegistryInfo[] }>("/api/registries"),
      ]);
      setTransactions(txs.transactions);
      setBalance(txs.balance);
      setRegistries(regs.registries);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [registryId]);

  const filtered = useMemo(
    () => transactions.filter((t) => filterType === "all" || t.type === filterType),
    [transactions, filterType]
  );

  const openCreate = (type?: string) => {
    setEditing(null);
    setForm({
      type: type ?? "EXPENSE",
      label: "",
      category: type === "INCOME" ? "COTISATION" : "ACHAT_MATERIEL",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      registryId: registryId !== "global" ? registryId : registries[0]?.id ?? "",
      attachmentUrl: null,
      note: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (t: TransactionRow) => {
    setEditing(t);
    setForm({
      type: t.type,
      label: t.label,
      category: t.category,
      amount: t.amount,
      date: new Date(t.date).toISOString().slice(0, 10),
      registryId: t.registry.id,
      attachmentUrl: t.attachmentUrl,
      note: t.note ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.label.trim()) {
      toast.error("Libellé requis");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await patch(`/api/transactions/${editing.id}`, form);
        toast.success("Écriture corrigée");
      } else {
        await post("/api/transactions", form);
        toast.success("Écriture enregistrée au journal de caisse");
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/api/transactions/${deleting.id}`);
      toast.success("Écriture supprimée");
      setDeleting(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const exportJournal = () => {
    const rows: (string | number)[][] = [
      ["Date", "Type", "Libellé", "Catégorie", "Registre", "Montant (FCFA)", "Pièce"],
      ...filtered.map((t) => [
        formatDate(t.date),
        t.type === "INCOME" ? "Entrée" : "Sortie",
        t.label,
        CAT_LABELS[t.category] ?? t.category,
        t.registry.name,
        t.amount,
        t.attachmentUrl ? "Oui" : "Non",
      ]),
      ["", "", "", "", "SOLDE", balance.current, ""],
    ];
    downloadCSV(`journal-de-caisse-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("Journal de caisse exporté (CSV/Excel)");
  };

  const categories = form.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Landmark}
        title="Trésorerie"
        description="Journal de caisse du porte-monnaie familial : entrées, sorties et pièces justificatives."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportJournal}>
              <Download className="w-4 h-4 mr-1.5" /> Exporter
            </Button>
            <Button variant="outline" size="sm" onClick={() => openCreate("INCOME")}>
              <ArrowDownLeft className="w-4 h-4 mr-1.5 text-emerald-600" /> Recette
            </Button>
            <Button size="sm" onClick={() => openCreate("EXPENSE")}>
              <ArrowUpRight className="w-4 h-4 mr-1.5" /> Dépense
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard title="Solde actuel (temps réel)" value={formatMoney(balance.current)} icon={Landmark} tone={balance.current >= 0 ? "primary" : "danger"} hint="Entrées − Sorties" />
        <StatCard title="Total des recettes" value={formatMoney(balance.totalIncome)} icon={ArrowDownLeft} tone="gold" />
        <StatCard title="Total des dépenses" value={formatMoney(balance.totalExpense)} icon={ArrowUpRight} tone="danger" />
      </div>

      {/* Filtres */}
      <Card className="border-border/70">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <Tabs value={filterType} onValueChange={setFilterType} className="flex-1">
            <TabsList className="w-full sm:w-auto grid grid-cols-3">
              <TabsTrigger value="all" className="text-xs">Tout</TabsTrigger>
              <TabsTrigger value="INCOME" className="text-xs text-emerald-700">Entrées</TabsTrigger>
              <TabsTrigger value="EXPENSE" className="text-xs text-rose-600">Sorties</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={registryId} onValueChange={setRegistryId}>
            <SelectTrigger className="w-full sm:w-56">
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
        </CardContent>
      </Card>

      {/* Journal */}
      <Card className="border-border/70 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title="Journal de caisse vide" description="Enregistrez vos premières recettes et dépenses avec pièces justificatives." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="min-w-[90px]">Date</TableHead>
                  <TableHead className="min-w-[200px]">Libellé</TableHead>
                  <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                  <TableHead className="hidden lg:table-cell">Registre</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="hover:bg-secondary/30">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(t.date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`rounded-lg p-1.5 shrink-0 ${t.type === "INCOME" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}
                        >
                          {t.type === "INCOME" ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.label}</p>
                          {t.attachmentUrl && (
                            <a href={t.attachmentUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                              <Paperclip className="w-3 h-3" /> Pièce jointe
                            </a>
                          )}
                          {t.note && <p className="text-[10px] text-muted-foreground truncate">{t.note}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="font-normal text-xs">
                        {CAT_LABELS[t.category] ?? t.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{t.registry.name}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className={`text-sm font-semibold tabular-nums ${t.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}`}>
                        {t.type === "INCOME" ? "+" : "−"} {formatMoney(t.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(t)}>
                            <Pencil className="w-4 h-4 mr-2" /> Corriger
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-600" onClick={() => setDeleting(t)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Dialog écriture */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Corriger l'écriture" : form.type === "INCOME" ? "Nouvelle recette" : "Nouvelle dépense"}</DialogTitle>
            <DialogDescription>
              {TRANSACTION_TYPE_LABELS[form.type]} — date, libellé, catégorie et montant sont obligatoires.
            </DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Type de flux</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!!editing}
                  className={`rounded-lg border p-3 text-sm font-medium transition-colors ${form.type === "INCOME" ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "hover:bg-secondary"}`}
                  onClick={() => setForm({ ...form, type: "INCOME", category: "COTISATION" })}
                >
                  Entrée (Recette)
                </button>
                <button
                  type="button"
                  disabled={!!editing}
                  className={`rounded-lg border p-3 text-sm font-medium transition-colors ${form.type === "EXPENSE" ? "border-rose-400 bg-rose-500/10 text-rose-700" : "hover:bg-secondary"}`}
                  onClick={() => setForm({ ...form, type: "EXPENSE", category: "ACHAT_MATERIEL" })}
                >
                  Sortie (Dépense)
                </button>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Libellé *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={form.type === "INCOME" ? "Cotisation collectée — réunion de septembre" : "Achat de 20 sacs de ciment"} />
            </div>
            <div className="space-y-2">
              <Label>Catégorie *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categories).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Montant (FCFA) *</Label>
              <Input type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Registre *</Label>
              <Select value={form.registryId} onValueChange={(v) => setForm({ ...form, registryId: v })} disabled={!!editing}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir" />
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
            <div className="sm:col-span-2">
              <ProofUpload
                label="Pièce justificative (facture / reçu) — optionnel"
                value={form.attachmentUrl}
                onChange={(url) => setForm({ ...form, attachmentUrl: url })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Note</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Enregistrer la correction" : "Enregistrer au journal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
