"use client";
// ============================================================
// PGF — Vue Membres (fiches, Registre Global, CRUD)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { get, post, patch, del } from "../api";
import type { MemberRow, RegistryInfo } from "../types";
import { PageHeader, MemberAvatar, RoleBadge, EmptyState } from "../shared/ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Plus, Search, MoreHorizontal, Pencil, Trash2, KeyRound, Globe2, Download, Loader2, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/format";
import { ROLE_LABELS, ROLES } from "@/lib/constants";
import { downloadCSV } from "../api";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  phone: "",
  city: "",
  position: "",
  registryId: "",
  role: ROLES.MEMBER,
  resetPassword: false,
};

export function MembersView() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [registries, setRegistries] = useState<RegistryInfo[]>([]);
  const [scope, setScope] = useState<string>("global"); // global | registre
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [deleting, setDeleting] = useState<MemberRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const [mem, reg] = await Promise.all([
        get<{ members: MemberRow[] }>("/api/members"),
        get<{ registries: RegistryInfo[] }>("/api/registries"),
      ]);
      setMembers(mem.members);
      setRegistries(reg.registries);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (scope !== "global" && m.registry.id !== scope) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
          m.phone.includes(q) ||
          (m.city ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [members, scope, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, registryId: registries[0]?.id ?? "" });
    setDialogOpen(true);
  };

  const openEdit = (m: MemberRow) => {
    setEditing(m);
    setForm({
      firstName: m.firstName,
      lastName: m.lastName,
      phone: m.phone,
      city: m.city ?? "",
      position: m.position ?? "",
      registryId: m.registry.id,
      role: m.role,
      resetPassword: false,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Nom et prénoms requis");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await patch(`/api/members/${editing.id}`, {
          ...form,
          city: form.city || null,
          position: form.position || null,
        });
        toast.success("Fiche membre mise à jour");
      } else {
        await post("/api/members", { ...form, city: form.city || null, position: form.position || null });
        toast.success("Membre ajouté — répliqué automatiquement au Registre Global. Mot de passe par défaut : Famille2026!");
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
      await del(`/api/members/${deleting.id}`);
      toast.success("Membre retiré du registre");
      setDeleting(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["Nom", "Prénoms", "Téléphone", "Localité", "Registre", "Rôle", "Cotisé (FCFA)", "Adhésion"],
      ...filtered.map((m) => [
        m.lastName,
        m.firstName,
        m.phone,
        m.city ?? "",
        m.registry.name,
        ROLE_LABELS[m.role] ?? m.role,
        m.totalPaid ?? 0,
        formatDate(m.joinedAt),
      ]),
    ];
    downloadCSV(`annuaire-membres-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("Annuaire exporté (CSV/Excel)");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Users}
        title="Gestion des membres"
        description="Fiches membres, rôles et connexion par numéro de téléphone."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1.5" /> Exporter l'annuaire
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Ajouter un membre
            </Button>
          </>
        }
      />

      {/* Filtres */}
      <Card className="border-border/70">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, téléphone ou localité…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                <span className="flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-primary" /> Registre Global ({members.length})
                </span>
              </SelectItem>
              {registries.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.membersCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/70 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="Aucun membre" description="Ajustez vos filtres ou ajoutez de nouveaux membres." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="min-w-[220px]">Membre</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden sm:table-cell">Registre</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Total cotisé</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id} className="hover:bg-secondary/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <MemberAvatar firstName={m.firstName} lastName={m.lastName} />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {m.lastName} {m.firstName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.position ? `${m.position} · ` : ""}
                            <MapPin className="inline w-3 h-3 -mt-0.5" /> {m.city ?? "Localité non renseignée"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm tabular-nums">
                        <Phone className="inline w-3.5 h-3.5 -mt-1 mr-1 text-muted-foreground" />
                        {m.phone}
                      </span>
                      {m.mustChangePassword && (
                        <Badge variant="outline" className="ml-2 text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                          MDP par défaut
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="font-normal">
                        {m.registry.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={m.role} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right">
                      {m.totalPaid != null ? (
                        <span className="text-sm font-semibold tabular-nums">{formatMoney(m.totalPaid)}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                      {m.pendingCount ? (
                        <span className="ml-1 text-[10px] text-amber-600">({m.pendingCount} en attente)</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(m)}>
                            <Pencil className="w-4 h-4 mr-2" /> Modifier la fiche
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(m);
                              setForm({
                                firstName: m.firstName,
                                lastName: m.lastName,
                                phone: m.phone,
                                city: m.city ?? "",
                                position: m.position ?? "",
                                registryId: m.registry.id,
                                role: m.role,
                                resetPassword: true,
                              });
                              setDialogOpen(true);
                            }}
                          >
                            <KeyRound className="w-4 h-4 mr-2" /> Réinitialiser le mot de passe
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-600" onClick={() => setDeleting(m)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Retirer du registre
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

      {/* Dialog fiche membre */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto pgf-scroll">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la fiche membre" : "Nouveau membre"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Mettez à jour l'identité, le contact ou le rôle. Le changement de registre est possible."
                : "Le membre sera ajouté au registre choisi et répliqué au Registre Global. Son identifiant de connexion est son numéro de téléphone."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom de famille *</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="AGBÉ" />
            </div>
            <div className="space-y-2">
              <Label>Prénoms *</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Kossi Éric" />
            </div>
            <div className="space-y-2">
              <Label>Téléphone (international) *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+228 90 12 34 56" className="tabular-nums" />
              <p className="text-[11px] text-muted-foreground">Sert de nom d'utilisateur pour la connexion.</p>
            </div>
            <div className="space-y-2">
              <Label>Localité / Ville</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lomé" />
            </div>
            <div className="space-y-2">
              <Label>Position dans la famille</Label>
              <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Aîné, cadette, oncle…" />
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
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROLES.MEMBER}>{ROLE_LABELS.MEMBER}</SelectItem>
                  <SelectItem value={ROLES.TREASURER}>{ROLE_LABELS.TREASURER}</SelectItem>
                  <SelectItem value={ROLES.HEAD}>{ROLE_LABELS.HEAD}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-amber-600" /> Réinitialiser le mot de passe
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Nouveau mot de passe : Famille2026! — modification obligatoire à la prochaine connexion.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-amber-600"
                  checked={form.resetPassword}
                  onChange={(e) => setForm({ ...form, resetPassword: e.target.checked })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Enregistrer" : "Ajouter au registre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Retirer {deleting ? `${deleting.lastName} ${deleting.firstName}` : ""} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le membre sera désactivé et ne pourra plus se connecter. Son historique financier est conservé pour la traçabilité.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-rose-600 hover:bg-rose-700">
              Retirer le membre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
