"use client";
// ============================================================
// PGF — Mes cotisations (espace membre)
// Voir ses dus, déclarer un paiement avec preuve, historique
// ============================================================
import { useEffect, useState } from "react";
import { get, post } from "../api";
import type { CampaignRow, PaymentRow } from "../types";
import { PageHeader, PaymentStatusBadge, MoneyText, EmptyState } from "../shared/ui-bits";
import { ProofUpload } from "../shared/proof-upload";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, Smartphone, Banknote, Landmark, HelpCircle, Loader2, CheckCircle2, Clock, ExternalLink, Receipt } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";

export function MyContributionsView() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proofView, setProofView] = useState<PaymentRow | null>(null);
  const [form, setForm] = useState<any>({
    campaignId: "",
    amount: "",
    method: "MOBILE_MONEY",
    reference: "",
    proofUrl: null,
    note: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [camps, pays] = await Promise.all([
        get<{ campaigns: CampaignRow[] }>("/api/campaigns?status=ACTIVE"),
        get<{ payments: PaymentRow[] }>("/api/payments?mine=1"),
      ]);
      setCampaigns(camps.campaigns);
      setPayments(pays.payments);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const myPledge = (c: CampaignRow) => c.pledges.find((p) => (p as any).memberId === (c.pledges[0]?.memberId ?? ""));

  // Ouvrir le dialog pré-rempli pour une campagne
  const openDeclare = (campaign?: CampaignRow) => {
    setForm({
      campaignId: campaign?.id ?? "",
      amount: campaign ? campaign.pledges.find((p) => p.amountDue > p.amountPaid)?.amountDue ?? "" : "",
      method: "MOBILE_MONEY",
      reference: "",
      proofUrl: null,
      note: "",
    });
    setDialogOpen(true);
  };

  // Récupérer mes engagements par campagne
  const myCampaampaignDues = (c: CampaignRow) => {
    // NOTE : l'API renvoie les pledges de tous les membres pour le suivi admin,
    // mais l'espace membre affiche seulement SES dues via /api/stats.
    // Ici on filtre côté serveur : le pledge du membre courant est identifié
    // par le filtre "mine" de l'API stats ; on réutilise payments pour l'historique.
    return c.pledges;
  };

  const declare = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setSaving(true);
    try {
      await post("/api/payments", {
        campaignId: form.campaignId || null,
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || null,
        proofUrl: form.proofUrl,
        note: form.note || null,
      });
      toast.success("Paiement déclaré — en attente de validation par le trésorier");
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Wallet}
        title="Mes cotisations"
        description="Déclarez vos paiements avec preuve (capture Mobile Money, reçu) — validation par le trésorier."
        actions={
          <Button size="sm" onClick={() => openDeclare()}>
            <Receipt className="w-4 h-4 mr-1.5" /> Déclarer un paiement
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Campagnes actives où je dois quelque chose */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Campagnes actives</h2>
            {campaigns.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Aucune campagne active" description="Aucune cotisation n'est actuellement ouverte." />
            ) : (
              campaigns.map((c) => {
                const myPledge = c.pledges.length === 1 ? c.pledges[0] : null;
                return (
                  <Card key={c.id} className="border-border/70">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold truncate">{c.name}</h3>
                            <Badge variant="outline" className="text-[10px]">
                              {c.type === "MONTHLY" ? "Mensuelle" : "Occasionnelle"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {c.registry.name}
                            {c.dueDay ? ` · échéance le ${c.dueDay} du mois` : c.endDate ? ` · jusqu'au ${formatDate(c.endDate)}` : ""}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openDeclare(c)}>
                          Payer ma part
                        </Button>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">Collecte globale</span>
                          <span className="font-medium">
                            {formatMoney(c.collected)} {c.targetAmount > 0 && `/ ${formatMoney(c.targetAmount)}`}
                          </span>
                        </div>
                        <Progress value={c.targetAmount > 0 ? Math.min(100, (c.collected / c.targetAmount) * 100) : c.expected > 0 ? Math.min(100, (c.collected / c.expected) * 100) : 0} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Historique de mes paiements */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Mon historique</h2>
            <Card className="border-border/70">
              <CardContent className="p-0">
                {payments.length === 0 ? (
                  <EmptyState icon={Receipt} title="Aucun paiement" description="Vos paiements déclarés apparaîtront ici avec leur statut." />
                ) : (
                  <div className="divide-y divide-border/60">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                        <span
                          className={`rounded-lg p-2 shrink-0 ${
                            p.status === "VALIDATED" ? "bg-emerald-500/10 text-emerald-600" : p.status === "PENDING" ? "bg-amber-500/10 text-amber-600" : "bg-rose-500/10 text-rose-600"
                          }`}
                        >
                          {p.status === "VALIDATED" ? <CheckCircle2 className="w-4 h-4" /> : p.status === "PENDING" ? <Clock className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{p.campaign?.name ?? "Cotisation libre"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDate(p.paidAt)} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                            {p.reference ? ` · Réf ${p.reference}` : ""}
                          </p>
                        </div>
                        <MoneyText value={p.amount} className="text-sm font-semibold" />
                        <div className="flex items-center gap-2">
                          {p.proofUrl && (
                            <Button variant="link" size="sm" className="h-7 p-0" onClick={() => setProofView(p)}>
                              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Reçu
                            </Button>
                          )}
                          <PaymentStatusBadge status={p.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Dialog déclaration de paiement */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Déclarer un paiement</DialogTitle>
            <DialogDescription>
              Après votre versement (Mobile Money, espèces…), joignez la preuve. Le trésorier validera et votre situation sera mise à jour.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Campagne</Label>
              <Select value={form.campaignId} onValueChange={(v) => setForm({ ...form, campaignId: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Cotisation libre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Cotisation libre</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Montant versé (FCFA) *</Label>
              <Input type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="tabular-nums" />
            </div>
            <div className="space-y-2">
              <Label>Méthode de paiement *</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOBILE_MONEY">Mobile Money (T-Money, Wave…)</SelectItem>
                  <SelectItem value="CASH">Espèces</SelectItem>
                  <SelectItem value="BANK">Virement bancaire</SelectItem>
                  <SelectItem value="OTHER">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Référence de transaction</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Ex : TM-20260909-84512" />
            </div>
            <ProofUpload
              label="Preuve de paiement (photo/ capture, PDF) *"
              value={form.proofUrl}
              onChange={(url) => setForm({ ...form, proofUrl: url })}
            />
            <div className="space-y-2">
              <Label>Note (optionnel)</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={declare} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Envoyer pour validation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog preuve */}
      <Dialog open={!!proofView} onOpenChange={(v) => !v && setProofView(null)}>
        <DialogContent className="sm:max-w-md">
          {proofView && (
            <>
              <DialogHeader>
                <DialogTitle>Mon reçu</DialogTitle>
                <DialogDescription>
                  {formatMoney(proofView.amount)} · {PAYMENT_METHOD_LABELS[proofView.method] ?? proofView.method}
                  {proofView.reference ? ` · Réf ${proofView.reference}` : ""}
                </DialogDescription>
              </DialogHeader>
              {proofView.proofUrl && !proofView.proofUrl.endsWith(".pdf") && (
                <img src={proofView.proofUrl} alt="Preuve de paiement" className="rounded-lg border max-h-[60vh] w-full object-contain" />
              )}
              {proofView.proofUrl?.endsWith(".pdf") && (
                <div className="rounded-lg border p-6 text-center">
                  <a href={proofView.proofUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm font-medium">
                    Ouvrir le reçu PDF
                  </a>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
