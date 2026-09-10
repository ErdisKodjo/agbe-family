"use client";
// ============================================================
// PGF — Module Cotisations (mensuelles + occasionnelles)
// + validation des paiements avec preuve
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { get, post, patch, del, put } from "../api";
import type { CampaignRow, PaymentRow, RegistryInfo, MemberRow, PledgeDetail } from "../types";
import { PageHeader, MemberAvatar, PaymentStatusBadge, FundingBar, EmptyState, MoneyText } from "../shared/ui-bits";
import { ProofUpload } from "../shared/proof-upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Wallet,
  Plus,
  CalendarClock,
  Megaphone,
  CheckCircle2,
  XCircle,
  Eye,
  Trash2,
  Loader2,
  Coins,
  Users2,
  Download,
  Pencil,
  ExternalLink,
  HandCoins,
  Flower2,
  HeartHandshake,
  Baby,
  Droplets,
  Stethoscope,
  GraduationCap,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate, monthLabel } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { downloadCSV } from "../api";

// Modèles de cotisations nommées (occasionnelles) — pré-remplissent l'intitulé
const OCCASION_TEMPLATES = [
  {
    id: "FUNERAILLES",
    label: "Funérailles",
    icon: Flower2,
    name: "Cotisation pour les funérailles de ",
    description: "Soutien exceptionnel à la famille endeuillée.",
  },
  {
    id: "MARIAGE",
    label: "Mariage",
    icon: HeartHandshake,
    name: "Cotisation pour le mariage de ",
    description: "Soutien au mariage du membre de la famille.",
  },
  {
    id: "BAPTEME",
    label: "Baptême",
    icon: Droplets,
    name: "Cotisation pour le baptême de ",
    description: "Cotisation pour le baptême de l'enfant.",
  },
  {
    id: "NAISSANCE",
    label: "Naissance",
    icon: Baby,
    name: "Cotisation pour la naissance de ",
    description: "Cadeau de bienvenue au nouveau-né.",
  },
  {
    id: "MALADIE",
    label: "Maladie / Accident",
    icon: Stethoscope,
    name: "Cotisation pour les soins de ",
    description: "Assistance médicale du membre.",
  },
  {
    id: "ETUDES",
    label: "Études",
    icon: GraduationCap,
    name: "Cotisation pour les études de ",
    description: "Aide à la scolarité de l'enfant.",
  },
  {
    id: "AUTRE",
    label: "Autre",
    icon: Tag,
    name: "",
    description: "",
  },
] as const;

export function ContributionsView() {
  const [tab, setTab] = useState("monthly");
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [registries, setRegistries] = useState<RegistryInfo[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<CampaignRow | null>(null);
  const [pledgesDialog, setPledgesDialog] = useState<CampaignRow | null>(null);
  const [deleting, setDeleting] = useState<CampaignRow | null>(null);
  const [proofView, setProofView] = useState<PaymentRow | null>(null);
  const [saving, setSaving] = useState(false);

  // ---- Encaissement direct (saisie admin) ----
  const [cashInOpen, setCashInOpen] = useState(false);
  const [cashForm, setCashForm] = useState<any>({
    memberId: "",
    campaignId: "",
    amount: "",
    method: "MOBILE_MONEY",
    reference: "",
    note: "",
    proofUrl: null as string | null,
  });

  const [form, setForm] = useState<any>({
    type: "MONTHLY",
    name: "",
    description: "",
    registryId: "",
    amount: 5000,
    dueDay: 5,
    periodMonth: new Date().getMonth() + 1,
    periodYear: new Date().getFullYear(),
    targetAmount: 0,
    allowCustom: false,
    startDate: "",
    endDate: "",
  });

  // Formulaire montants personnalisés (Option B)
  const [customPledges, setCustomPledges] = useState<Record<string, number>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);

  const load = async (): Promise<CampaignRow[] | undefined> => {
    setLoading(true);
    try {
      const [camps, pays, regs, mems] = await Promise.all([
        get<{ campaigns: CampaignRow[] }>("/api/campaigns"),
        get<{ payments: PaymentRow[] }>("/api/payments?status=PENDING"),
        get<{ registries: RegistryInfo[] }>("/api/registries"),
        get<{ members: MemberRow[] }>("/api/members"),
      ]);
      setCampaigns(camps.campaigns);
      setPayments(pays.payments);
      setRegistries(regs.registries);
      setMembers(mems.members);
      return camps.campaigns;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const monthly = campaigns.filter((c) => c.type === "MONTHLY" && c.status === "ACTIVE");
  const occasional = campaigns.filter((c) => c.type === "OCCASIONAL");
  const pendingCount = payments.length;

  const openCreate = (type: string) => {
    setForm({
      ...form,
      type,
      name: "",
      description: "",
      occasion: "",
      registryId: registries[0]?.id ?? "",
      amount: type === "MONTHLY" ? 5000 : 0,
      targetAmount: type === "OCCASIONAL" ? 100000 : 0,
      allowCustom: false,
      periodMonth: new Date().getMonth() + 1,
      periodYear: new Date().getFullYear(),
    });
    setCustomPledges({});
    setCreateOpen(true);
  };

  // Cotisation nommée : applique un modèle d'événement (funérailles, mariage…)
  // puis place le curseur à la fin de l'intitulé pour compléter « de X »
  const applyTemplate = (t: (typeof OCCASION_TEMPLATES)[number]) => {
    setForm((f) => ({ ...f, occasion: t.id, name: t.name, description: t.description }));
    setTimeout(() => {
      const el = nameInputRef.current;
      if (el) {
        el.focus();
        const pos = el.value.length;
        el.setSelectionRange(pos, pos);
      }
    }, 40);
  };

  const saveCampaign = async () => {
    if (!form.name.trim()) {
      toast.error("Nom de la campagne requis");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        type: form.type,
        name: form.name,
        description: form.description,
        registryId: form.registryId,
      };
      if (form.type === "MONTHLY") {
        payload.amount = Number(form.amount);
        payload.dueDay = Number(form.dueDay);
        payload.periodMonth = Number(form.periodMonth);
        payload.periodYear = Number(form.periodYear);
      } else {
        payload.targetAmount = Number(form.targetAmount);
        payload.allowCustom = form.allowCustom;
        payload.amount = Number(form.amount);
        if (form.startDate) payload.startDate = form.startDate;
        if (form.endDate) payload.endDate = form.endDate;
        if (form.allowCustom) {
          payload.pledges = Object.entries(customPledges)
            .filter(([, v]) => v > 0)
            .map(([memberId, amountDue]) => ({ memberId, amountDue: Number(amountDue) }));
        }
      }
      await post("/api/campaigns", payload);
      toast.success("Campagne créée et engagements générés");
      setCreateOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const savePledges = async () => {
    if (!pledgesDialog) return;
    const pledges = Object.entries(customPledges).map(([memberId, amountDue]) => ({
      memberId,
      amountDue: Number(amountDue),
    }));
    if (pledges.length === 0) {
      toast.error("Cochez au moins un membre avec un montant");
      return;
    }
    setSaving(true);
    try {
      await put(`/api/campaigns/${pledgesDialog.id}/pledges`, { pledges });
      toast.success("Répartition personnalisée enregistrée");
      setPledgesDialog(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const validatePayment = async (p: PaymentRow, action: "VALIDATED" | "REJECTED") => {
    try {
      await patch(`/api/payments/${p.id}`, { action });
      toast.success(action === "VALIDATED" ? "Paiement validé — trésorerie créditée" : "Paiement rejeté");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ---- Encaissement direct : ouverture (avec pré-remplissage depuis le suivi) ----
  const openCashIn = (memberId = "", campaignId = "", amount = "") => {
    setCashForm({
      memberId,
      campaignId,
      amount,
      method: "CASH",
      reference: "",
      note: "",
      proofUrl: null,
    });
    setCashInOpen(true);
  };

  // Reste dû suggéré pour le couple (membre, campagne) sélectionné
  const suggestedRest = useMemo(() => {
    if (!cashForm.memberId || !cashForm.campaignId) return null;
    const c = campaigns.find((x) => x.id === cashForm.campaignId);
    const pledge = c?.pledges.find((p) => p.memberId === cashForm.memberId);
    if (!pledge) return null;
    const rest = Math.max(0, pledge.amountDue - pledge.amountPaid);
    return rest > 0 ? rest : null;
  }, [cashForm.memberId, cashForm.campaignId, campaigns]);

  // Campagnes proposées à l'encaissement (actives + celle pré-remplie si clôturée)
  const cashCampaigns = useMemo(() => {
    const active = campaigns.filter((c) => c.status === "ACTIVE");
    const cur = campaigns.find((c) => c.id === cashForm.campaignId);
    return cur && cur.status !== "ACTIVE" ? [...active, cur] : active;
  }, [campaigns, cashForm.campaignId]);

  const saveCashIn = async () => {
    if (!cashForm.memberId) {
      toast.error("Choisissez le membre concerné");
      return;
    }
    const amount = Number(cashForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setSaving(true);
    try {
      await post("/api/payments", {
        memberId: cashForm.memberId,
        campaignId: cashForm.campaignId || null,
        amount,
        method: cashForm.method,
        reference: cashForm.reference || null,
        note: cashForm.note || null,
        proofUrl: cashForm.proofUrl,
        direct: true,
      });
      toast.success("Cotisation encaissée — trésorerie créditée");
      setCashInOpen(false);
      const fresh = await load();
      // Resynchronise le suivi détaillé resté ouvert derrière le dialogue d'encaissement
      if (detail) {
        const updated = fresh?.find((c) => c.id === detail.id);
        if (updated) setDetail(updated);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const closeCampaign = async (c: CampaignRow) => {
    try {
      await patch(`/api/campaigns/${c.id}`, { status: "CLOSED" });
      toast.success("Campagne clôturée");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeCampaign = async () => {
    if (!deleting) return;
    try {
      await del(`/api/campaigns/${deleting.id}`);
      toast.success("Campagne supprimée");
      setDeleting(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const exportStatus = (c: CampaignRow) => {
    const rows: (string | number)[][] = [
      [c.name, "", "", "", ""],
      ["Membre", "Téléphone", "Dû (FCFA)", "Payé (FCFA)", "Reste (FCFA)", "Statut"],
      ...c.pledges.map((p) => [
        `${p.member.lastName} ${p.member.firstName}`,
        p.member.phone,
        p.amountDue,
        p.amountPaid,
        Math.max(0, p.amountDue - p.amountPaid),
        p.amountPaid >= p.amountDue && p.amountDue > 0 ? "À jour" : p.amountPaid > 0 ? "Partiel" : "En retard",
      ]),
    ];
    downloadCSV(`etat-cotisation-${c.name.replace(/\s+/g, "-").toLowerCase()}.csv`, rows);
    toast.success("État des cotisations exporté");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Wallet}
        title="Cotisations"
        description="Cotisations mensuelles récurrentes et appels à fonds occasionnels."
        actions={
          <>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => openCashIn()}
              title="Enregistrer une cotisation encaissée (espèces, Mobile Money…)"
            >
              <HandCoins className="w-4 h-4 mr-1.5" /> Encaisser
            </Button>
            <Button variant="outline" size="sm" onClick={() => openCreate("OCCASIONAL")}>
              <Megaphone className="w-4 h-4 mr-1.5" /> Appel à fonds
            </Button>
            <Button size="sm" onClick={() => openCreate("MONTHLY")}>
              <Plus className="w-4 h-4 mr-1.5" /> Cotisation mensuelle
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex h-auto sm:h-9">
          <TabsTrigger value="monthly" className="gap-1.5 text-xs sm:text-sm">
            <CalendarClock className="w-4 h-4" /> Mensuelles
          </TabsTrigger>
          <TabsTrigger value="occasional" className="gap-1.5 text-xs sm:text-sm">
            <Megaphone className="w-4 h-4" /> Occasionnelles
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5 text-xs sm:text-sm relative">
            <Coins className="w-4 h-4" /> À valider
            {pendingCount > 0 && (
              <Badge className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 min-w-5 h-5 justify-center">{pendingCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ================= MENSUELLES ================= */}
        <TabsContent value="monthly" className="mt-4 space-y-4">
          {loading ? (
            <Card className="h-40 animate-pulse" />
          ) : monthly.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Aucune cotisation mensuelle active" description="Créez la cotisation du mois : montant fixe et date butoire." />
          ) : (
            monthly.map((c) => (
              <Card key={c.id} className="border-border/70">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="rounded-xl bg-primary/10 text-primary p-3 shrink-0">
                        <CalendarClock className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold truncate">{c.name}</h3>
                          <Badge variant="outline" className="bg-secondary text-[10px]">
                            {monthLabel(c.periodMonth)} {c.periodYear}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {formatMoney(c.amount)} / membre · échéance le {c.dueDay} · {c.registry.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportStatus(c)}>
                        <Download className="w-4 h-4 mr-1.5" /> Exporter
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDetail(c)}>
                        <Eye className="w-4 h-4 mr-1.5" /> Suivi
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(c)} className="text-rose-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">
                        {c.contributorsCount}/{c.pledges.length} membres à jour
                      </span>
                      <span className="font-semibold">
                        {formatMoney(c.collected)} / {formatMoney(c.expected)}
                      </span>
                    </div>
                    <Progress value={c.expected > 0 ? Math.min(100, (c.collected / c.expected) * 100) : 0} className="h-2.5" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ================= OCCASIONNELLES ================= */}
        <TabsContent value="occasional" className="mt-4 space-y-4">
          {loading ? (
            <Card className="h-40 animate-pulse" />
          ) : occasional.length === 0 ? (
            <EmptyState icon={Megaphone} title="Aucun appel à fonds" description={"Lancez une campagne : « Cotisation pour le mariage de Jean », « Fonds d'urgence »…"} />
          ) : (
            occasional.map((c) => (
              <Card key={c.id} className="border-border/70">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="rounded-xl bg-amber-500/15 text-amber-600 p-3 shrink-0">
                        <Megaphone className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold truncate">{c.name}</h3>
                          {c.status === "CLOSED" && <Badge variant="secondary">Clôturée</Badge>}
                          {c.allowCustom && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px]">
                              Montants personnalisés
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                          {c.description || "Appel à fonds"} · {c.registry.name}
                          {c.endDate ? ` · jusqu'au ${formatDate(c.endDate)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.allowCustom && c.status === "ACTIVE" && (
                        <Button variant="outline" size="sm" onClick={() => {
                          setPledgesDialog(c);
                          const map: Record<string, number> = {};
                          c.pledges.forEach((p) => (map[p.memberId] = p.amountDue));
                          setCustomPledges(map);
                        }}>
                          <Pencil className="w-4 h-4 mr-1.5" /> Répartition
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => exportStatus(c)}>
                        <Download className="w-4 h-4 mr-1.5" /> Exporter
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDetail(c)}>
                        <Eye className="w-4 h-4 mr-1.5" /> Suivi
                      </Button>
                      {c.status === "ACTIVE" && (
                        <Button variant="ghost" size="sm" onClick={() => closeCampaign(c)} title="Clôturer">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(c)} className="text-rose-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">
                        Objectif : {formatMoney(c.targetAmount)} · {c.contributorsCount} contributeur(s)
                      </span>
                      <span className="font-semibold">
                        {formatMoney(c.collected)}
                        {c.targetAmount > 0 ? ` (${Math.min(100, Math.round((c.collected / c.targetAmount) * 100))}%)` : ""}
                      </span>
                    </div>
                    <FundingBar value={c.targetAmount > 0 ? (c.collected / c.targetAmount) * 100 : 0} />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ================= PAIEMENTS À VALIDER ================= */}
        <TabsContent value="pending" className="mt-4">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-600" /> Paiements en attente de validation
              </CardTitle>
              <CardDescription>
                Vérifiez les preuves (captures Mobile Money, reçus) puis validez — la trésorerie est créditée automatiquement.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Aucun paiement en attente" description="Toutes les déclarations de paiement ont été traitées." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                        <TableHead>Membre</TableHead>
                        <TableHead className="hidden md:table-cell">Campagne</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead className="hidden sm:table-cell">Méthode</TableHead>
                        <TableHead>Preuve</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <MemberAvatar firstName={p.member.firstName} lastName={p.member.lastName} size="sm" />
                              <div>
                                <p className="text-sm font-medium">
                                  {p.member.lastName} {p.member.firstName}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{formatDate(p.paidAt)}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className="font-normal text-xs">
                              {p.campaign?.name ?? "Cotisation libre"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <MoneyText value={p.amount} className="font-semibold text-sm" />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs">
                            {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                            {p.reference && <p className="text-muted-foreground text-[10px]">Réf : {p.reference}</p>}
                          </TableCell>
                          <TableCell>
                            {p.proofUrl ? (
                              <Button variant="link" size="sm" className="h-7 p-0 text-primary" onClick={() => setProofView(p)}>
                                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Voir
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="h-8 bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => validatePayment(p, "VALIDATED")}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Valider
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => validatePayment(p, "REJECTED")}>
                                <XCircle className="w-4 h-4 mr-1" /> Rejeter
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================= Dialog création campagne ================= */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto pgf-scroll">
          <DialogHeader>
            <DialogTitle>
              {form.type === "MONTHLY" ? "Nouvelle cotisation mensuelle" : "Nouvel appel à fonds"}
            </DialogTitle>
            <DialogDescription>
              {form.type === "MONTHLY"
                ? "Définissez le montant fixe et la date butoire. Tous les membres du registre seront engagés."
                : "Lancez une campagne nommée (funérailles, mariage, baptême…) avec montant unique ou personnalisé par membre."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-4">
            {form.type === "OCCASIONAL" && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Cotisation nommée — type d'événement</Label>
                <div className="flex flex-wrap gap-2">
                  {OCCASION_TEMPLATES.map((t) => {
                    const Icon = t.icon;
                    const active = form.occasion === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          active
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                        title={t.name ? `Pré-remplit : « ${t.name.trim()}… »` : "Intitulé libre"}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Choisissez un modèle puis complétez l'intitulé (ex : « Cotisation pour les funérailles de Papa X »).
                </p>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label>Intitulé *</Label>
              <Input
                ref={nameInputRef}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.type === "MONTHLY" ? `Cotisation Mensuelle ${monthLabel(new Date().getMonth() + 1)}` : "Cotisation pour le mariage de Jean"}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Registre *</Label>
              <Select value={form.registryId} onValueChange={(v) => setForm({ ...form, registryId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un registre" />
                </SelectTrigger>
                <SelectContent>
                  {registries.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.membersCount} membres)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.type === "MONTHLY" ? (
              <>
                <div className="space-y-2">
                  <Label>Montant mensuel (FCFA) *</Label>
                  <Input type="number" min={100} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="tabular-nums" />
                </div>
                <div className="space-y-2">
                  <Label>Date butoire (jour du mois)</Label>
                  <Input type="number" min={1} max={28} value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Période</Label>
                  <div className="flex gap-2">
                    <Select value={String(form.periodMonth)} onValueChange={(v) => setForm({ ...form, periodMonth: Number(v) })}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {monthLabel(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={form.periodYear}
                      onChange={(e) => setForm({ ...form, periodYear: Number(e.target.value) })}
                      className="w-24 tabular-nums"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Objectif global (FCFA)</Label>
                  <Input type="number" min={0} value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} className="tabular-nums" />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
                <div className="sm:col-span-2 rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Option B — Montants personnalisés</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Cochez les membres concernés et définissez leur dû (ex : les oncles 50 000, les cousins 10 000).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-primary"
                      checked={form.allowCustom}
                      onChange={(e) => setForm({ ...form, allowCustom: e.target.checked })}
                    />
                  </div>
                  {!form.allowCustom && (
                    <div className="space-y-2">
                      <Label className="text-xs">Option A — Montant unique pour tous (FCFA)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        className="tabular-nums"
                        placeholder="Ex : 10000"
                      />
                    </div>
                  )}
                  {form.allowCustom && (
                    <div className="max-h-56 overflow-y-auto pgf-scroll rounded-lg border divide-y">
                      {members
                        .filter((m) => !form.registryId || m.registry.id === form.registryId)
                        .map((m) => (
                          <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/50 cursor-pointer">
                            <Checkbox
                              checked={customPledges[m.id] !== undefined && customPledges[m.id] >= 0 && m.id in customPledges}
                              onCheckedChange={(checked) => {
                                setCustomPledges((prev) => {
                                  const next = { ...prev };
                                  if (checked) next[m.id] = next[m.id] ?? 10000;
                                  else delete next[m.id];
                                  return next;
                                });
                              }}
                            />
                            <MemberAvatar firstName={m.firstName} lastName={m.lastName} size="sm" />
                            <span className="text-sm flex-1 truncate">
                              {m.lastName} {m.firstName}
                            </span>
                            <Input
                              type="number"
                              min={0}
                              className="w-28 h-8 tabular-nums"
                              placeholder="Montant"
                              value={customPledges[m.id] ?? ""}
                              disabled={!(m.id in customPledges)}
                              onChange={(e) =>
                                setCustomPledges((prev) => ({ ...prev, [m.id]: Number(e.target.value) || 0 }))
                              }
                            />
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveCampaign} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Lancer la campagne
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= Dialog encaissement direct (admin) ================= */}
      <Dialog open={cashInOpen} onOpenChange={setCashInOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto pgf-scroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="rounded-lg bg-emerald-600/10 text-emerald-700 p-1.5">
                <HandCoins className="w-4 h-4" />
              </span>
              Encaisser une cotisation
            </DialogTitle>
            <DialogDescription>
              Cotisation reçue en main propre (espèces, Mobile Money, virement) : le paiement est enregistré comme
              validé et la trésorerie du registre créditée immédiatement.
            </DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Membre *</Label>
              <Select value={cashForm.memberId} onValueChange={(v) => setCashForm({ ...cashForm, memberId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir le membre cotisant" />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .slice()
                    .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr"))
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.lastName} {m.firstName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Campagne</Label>
              <Select
                value={cashForm.campaignId || "LIBRE"}
                onValueChange={(v) => setCashForm({ ...cashForm, campaignId: v === "LIBRE" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Affecter à une campagne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIBRE">Cotisation libre (sans campagne)</SelectItem>
                  {cashCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.status !== "ACTIVE" ? " (clôturée)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:col-span-2">
              <div className="space-y-2">
                <Label>Montant (FCFA) *</Label>
                <Input
                  type="number"
                  min={100}
                  step={100}
                  value={cashForm.amount}
                  onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                  className="tabular-nums"
                  placeholder="Ex : 5000"
                />
                {suggestedRest && (
                  <button
                    type="button"
                    className="text-xs text-primary font-medium hover:underline"
                    onClick={() => setCashForm({ ...cashForm, amount: String(suggestedRest) })}
                  >
                    Reste dû : {formatMoney(suggestedRest)} — utiliser ce montant
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <Label>Méthode</Label>
                <Select value={cashForm.method} onValueChange={(v) => setCashForm({ ...cashForm, method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PAYMENT_METHODS).map((m) => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Référence</Label>
              <Input
                value={cashForm.reference}
                onChange={(e) => setCashForm({ ...cashForm, reference: e.target.value })}
                placeholder="N° de transaction Mobile Money, n° de reçu…"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Note</Label>
              <Textarea
                value={cashForm.note}
                onChange={(e) => setCashForm({ ...cashForm, note: e.target.value })}
                rows={2}
                placeholder="Précision éventuelle (ex : acompte, don complémentaire…)"
              />
            </div>
            <div className="sm:col-span-2">
              <ProofUpload value={cashForm.proofUrl} onChange={(url) => setCashForm({ ...cashForm, proofUrl: url })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCashInOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveCashIn} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <HandCoins className="w-4 h-4 mr-1.5" /> Encaisser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= Dialog suivi détaillé ================= */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto pgf-scroll">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {detail.name}
                  <Badge variant="outline" className="text-[10px]">
                    {detail.type === "MONTHLY" ? "Mensuelle" : "Occasionnelle"}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Suivi détaillé : {detail.contributorsCount}/{detail.pledges.length} à jour · Collecté {formatMoney(detail.collected)} sur{" "}
                  {formatMoney(detail.expected)}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                      <TableHead>Membre</TableHead>
                      <TableHead className="text-right">Dû</TableHead>
                      <TableHead className="text-right">Payé</TableHead>
                      <TableHead className="text-right">Reste</TableHead>
                      <TableHead className="w-14"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.pledges
                      .slice()
                      .sort((a, b) => b.amountDue - a.amountPaid - (a.amountDue - a.amountPaid))
                      .map((p) => {
                        const rest = Math.max(0, p.amountDue - p.amountPaid);
                        const done = p.amountDue > 0 && p.amountPaid >= p.amountDue;
                        return (
                          <TableRow key={p.memberId}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <MemberAvatar firstName={p.member.firstName} lastName={p.member.lastName} size="sm" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {p.member.lastName} {p.member.firstName}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">{p.member.phone}</p>
                                </div>
                                {done && <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-1" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{formatMoney(p.amountDue)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{formatMoney(p.amountPaid)}</TableCell>
                            <TableCell className="text-right">
                              <span className={`text-sm font-semibold tabular-nums ${rest > 0 ? "text-amber-700" : "text-emerald-600"}`}>
                                {rest > 0 ? formatMoney(rest) : "—"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {rest > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                                  title={`Encaisser ${formatMoney(rest)} — ${p.member.firstName} ${p.member.lastName}`}
                                  onClick={() => openCashIn(p.memberId, detail.id, String(rest))}
                                >
                                  <HandCoins className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= Dialog répartition personnalisée ================= */}
      <Dialog open={!!pledgesDialog} onOpenChange={(v) => !v && setPledgesDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          {pledgesDialog && (
            <>
              <DialogHeader>
                <DialogTitle>Répartition personnalisée</DialogTitle>
                <DialogDescription>
                  « {pledgesDialog.name} » — cochez les membres et leur montant respectif (Option B).
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[50vh] overflow-y-auto pgf-scroll rounded-lg border divide-y">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 cursor-pointer">
                    <Checkbox
                      checked={m.id in customPledges}
                      onCheckedChange={(checked) => {
                        setCustomPledges((prev) => {
                          const next = { ...prev };
                          if (checked) next[m.id] = 10000;
                          else delete next[m.id];
                          return next;
                        });
                      }}
                    />
                    <MemberAvatar firstName={m.firstName} lastName={m.lastName} size="sm" />
                    <span className="text-sm flex-1 truncate">
                      {m.lastName} {m.firstName}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      className="w-28 h-8 tabular-nums"
                      placeholder="Montant"
                      value={customPledges[m.id] ?? ""}
                      disabled={!(m.id in customPledges)}
                      onChange={(e) => setCustomPledges((prev) => ({ ...prev, [m.id]: Number(e.target.value) || 0 }))}
                    />
                  </label>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPledgesDialog(null)}>
                  Annuler
                </Button>
                <Button onClick={savePledges} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enregistrer la répartition
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= Dialog preuve ================= */}
      <Dialog open={!!proofView} onOpenChange={(v) => !v && setProofView(null)}>
        <DialogContent className="sm:max-w-md">
          {proofView && (
            <>
              <DialogHeader>
                <DialogTitle>Preuve de paiement</DialogTitle>
                <DialogDescription>
                  {proofView.member.firstName} {proofView.member.lastName} · {formatMoney(proofView.amount)} ·{" "}
                  {PAYMENT_METHOD_LABELS[proofView.method]}
                  {proofView.reference ? ` · Réf ${proofView.reference}` : ""}
                </DialogDescription>
              </DialogHeader>
              {proofView.proofUrl?.endsWith(".pdf") ? (
                <div className="rounded-lg border p-6 text-center">
                  <a href={proofView.proofUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm font-medium">
                    Ouvrir le document PDF
                  </a>
                </div>
              ) : proofView.proofUrl ? (
                <img src={proofView.proofUrl} alt="Preuve de paiement" className="rounded-lg border max-h-[60vh] w-full object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune preuve jointe.</p>
              )}
              {proofView.note && <p className="text-xs text-muted-foreground mt-2">Note : {proofView.note}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les engagements et paiements déclarés de cette campagne seront également supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={removeCampaign} className="bg-rose-600 hover:bg-rose-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
