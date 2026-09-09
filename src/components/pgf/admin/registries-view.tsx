"use client";
// ============================================================
// PGF — Vue Registres (groupes familiaux + Registre Global)
// ============================================================
import { useEffect, useState } from "react";
import { get, post, patch, del } from "../api";
import type { RegistryInfo, MemberRow } from "../types";
import { PageHeader, MemberAvatar, MoneyText, EmptyState } from "../shared/ui-bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Globe2, Users, Landmark, FolderKanban, Plus, Pencil, Trash2, Crown, Network, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";

export function RegistriesView({ onChanged }: { onChanged?: () => void }) {
  const [registries, setRegistries] = useState<RegistryInfo[]>([]);
  const [globalInfo, setGlobalInfo] = useState<{ membersCount: number; balance: number } | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RegistryInfo | null>(null);
  const [deleting, setDeleting] = useState<RegistryInfo | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", description: "", transparency: false, headMemberId: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [reg, mem] = await Promise.all([
        get<{ registries: RegistryInfo[]; global: any }>("/api/registries"),
        get<{ members: MemberRow[] }>("/api/members"),
      ]);
      setRegistries(reg.registries);
      setGlobalInfo(reg.global);
      setMembers(mem.members);
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
    setEditing(null);
    setForm({ name: "", description: "", transparency: false, headMemberId: "" });
    setDialogOpen(true);
  };

  const openEdit = (r: RegistryInfo) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description ?? "",
      transparency: r.transparency,
      headMemberId: r.headMember?.id ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom du registre est requis");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await patch(`/api/registries/${editing.id}`, {
          name: form.name,
          description: form.description,
          transparency: form.transparency,
          headMemberId: form.headMemberId || null,
        });
        toast.success("Registre mis à jour");
      } else {
        await post("/api/registries", {
          name: form.name,
          description: form.description,
          transparency: form.transparency,
          headMemberId: form.headMemberId || null,
        });
        toast.success("Registre créé — il alimente automatiquement le Registre Global");
      }
      setDialogOpen(false);
      load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await del(`/api/registries/${deleting.id}`);
      toast.success("Registre supprimé");
      setDeleting(null);
      load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Network}
        title="Registres & Groupes"
        description="Branches, comités et sous-groupes de la famille. Chaque membre ajouté est répliqué au Registre Global."
        actions={
          <Button onClick={openCreate} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> Nouveau registre
          </Button>
        }
      />

      {/* ---- Registre Global ---- */}
      <Card className="border-primary/25 bg-gradient-to-r from-primary/5 via-card to-card">
        <CardContent className="p-5 flex items-center gap-4 flex-wrap">
          <div className="rounded-2xl bg-primary/10 text-primary p-3">
            <Globe2 className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold">Registre Global</h3>
              <Badge className="bg-primary text-primary-foreground text-[10px]">Vue maître automatique</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Base de données maître agrégeant tous les membres des registres spécifiques — utilisée pour les statistiques globales.
            </p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{globalInfo?.membersCount ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">membres</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                {globalInfo ? formatMoney(globalInfo.balance) : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">trésorerie cumulée</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Liste des registres ---- */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="h-48 animate-pulse" />
          ))}
        </div>
      ) : registries.length === 0 ? (
        <EmptyState icon={Network} title="Aucun registre" description="Créez votre premier registre (ex : « Famille AGBÉ — Branche Lomé »)." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {registries.map((r) => (
            <Card key={r.id} className="border-border/70 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{r.name}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">{r.description || "Aucune description"}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Modifier">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(r)} className="text-rose-600" aria-label="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-secondary/70 py-2">
                    <Users className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold leading-none">{r.membersCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">membres</p>
                  </div>
                  <div className="rounded-lg bg-secondary/70 py-2">
                    <FolderKanban className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold leading-none">{r.projectsCount}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">projets</p>
                  </div>
                  <div className="rounded-lg bg-secondary/70 py-2">
                    <Landmark className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold leading-none">
                      <MoneyText value={r.balance} className="text-sm" />
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">solde</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  {r.headMember ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                      <MemberAvatar firstName={r.headMember.firstName} lastName={r.headMember.lastName} size="sm" />
                      <span className="truncate text-xs">
                        <b>{r.headMember.lastName}</b> {r.headMember.firstName}
                        <span className="text-muted-foreground"> · Tête de liste</span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-muted-foreground/50" /> Aucune tête de liste
                    </span>
                  )}
                  {r.transparency && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 shrink-0">
                      Transparence totale
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Créé le {formatDate(r.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ---- Dialog création/édition ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le registre" : "Nouveau registre"}</DialogTitle>
            <DialogDescription>
              Ex : « Famille AGBÉ — Branche Nord », « Comité Mariage Jean & Aïcha ». Les membres y seront gérés par la tête de liste.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du registre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Famille AGBÉ — Branche Nord" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Registre des descendants de l'aïeul Kossi AGBÉ…"
              />
            </div>
            <div className="space-y-2">
              <Label>Tête de liste (administrateur du registre)</Label>
              <Select value={form.headMemberId} onValueChange={(v) => setForm({ ...form, headMemberId: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un membre…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucune —</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.lastName} {m.firstName} ({m.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                La tête de liste valide les membres de son groupe et les paiements.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3.5">
              <div className="pr-4">
                <p className="text-sm font-medium">Transparence totale</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Les membres peuvent voir les finances des autres membres de ce registre.
                </p>
              </div>
              <Switch checked={form.transparency} onCheckedChange={(v) => setForm({ ...form, transparency: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Enregistrer" : "Créer le registre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {deleting?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprime le registre ainsi que l'historique rattaché (membres, cotisations, écritures, projets).
              Cette opération est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-rose-600 hover:bg-rose-700">
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
