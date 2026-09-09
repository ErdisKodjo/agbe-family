"use client";
// ============================================================
// PGF — Annonces (fil de nouvelles, admin : publication)
// ============================================================
import { useEffect, useState } from "react";
import { get, post, del } from "../api";
import type { AnnouncementRow, CurrentMember } from "../types";
import { PageHeader, EmptyState, RoleBadge } from "../shared/ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Megaphone, Plus, Trash2, Loader2, Globe2, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";

const ADMIN_ROLES = ["SUPER_ADMIN", "HEAD", "TREASURER"];

export function AnnouncementsView({ me }: { me: CurrentMember }) {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", isGlobal: false });

  const isAdmin = ADMIN_ROLES.includes(me.role);

  const load = async () => {
    setLoading(true);
    try {
      const res = await get<{ announcements: AnnouncementRow[] }>("/api/announcements");
      setAnnouncements(res.announcements);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const publish = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Titre et contenu requis");
      return;
    }
    setSaving(true);
    try {
      await post("/api/announcements", form);
      toast.success("Annonce publiée");
      setDialogOpen(false);
      setForm({ title: "", content: "", isGlobal: false });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await del(`/api/announcements/${id}`);
      toast.success("Annonce supprimée");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Megaphone}
        title="Annonces"
        description={isAdmin ? "Publiez des nouvelles pour votre registre ou toute la famille." : "Nouvelles et informations de vos registres."}
        actions={
          isAdmin && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Publier une annonce
            </Button>
          )
        }
      />

      {loading ? (
        <div className="space-y-4 max-w-3xl">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="h-32 animate-pulse" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="Aucune annonce" description="Les nouvelles de la famille s'afficheront ici." />
      ) : (
        <div className="space-y-4 max-w-3xl">
          {announcements.map((a) => (
            <Card key={a.id} className="border-border/70 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2.5 shrink-0 ${a.isGlobal ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-600"}`}>
                    {a.isGlobal ? <Globe2 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold leading-snug">{a.title}</h3>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600 shrink-0" onClick={() => remove(a.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-line">{a.content}</p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {a.isGlobal ? "Toute la famille" : a.registry?.name ?? "Registre"}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        Par {a.author.firstName} {a.author.lastName} · {formatDateTime(a.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publier une annonce</DialogTitle>
            <DialogDescription>Visible selon la portée choisie.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Assemblée générale le 15 octobre" />
            </div>
            <div className="space-y-2">
              <Label>Contenu *</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} placeholder="Chers membres, la famille se réunit…" />
            </div>
            <label className="flex items-center gap-3 rounded-lg border p-3.5 cursor-pointer hover:bg-secondary/50">
              <input
                type="checkbox"
                className="w-5 h-5 accent-primary"
                checked={form.isGlobal}
                onChange={(e) => setForm({ ...form, isGlobal: e.target.checked })}
              />
              <div>
                <p className="text-sm font-medium">Diffuser à toute la famille</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sinon, l'annonce ne sera visible que par votre registre.</p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={publish} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
