"use client";
// ============================================================
// PGF — Profil membre (changement de mot de passe)
// ============================================================
import { useState } from "react";
import { post } from "../api";
import type { CurrentMember } from "../types";
import { PageHeader, RoleBadge, MemberAvatar } from "../shared/ui-bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, Phone, MapPin, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function ProfileView({ me, onUpdated }: { me: CurrentMember; onUpdated: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const rules = [
    { label: "Au moins 8 caractères", ok: newPassword.length >= 8 },
    { label: "Une majuscule", ok: /[A-Z]/.test(newPassword) },
    { label: "Un chiffre", ok: /\d/.test(newPassword) },
    { label: "Différent de l'actuel", ok: newPassword.length > 0 && newPassword !== currentPassword },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    try {
      await post("/api/auth/change-password", { currentPassword, newPassword });
      toast.success("Mot de passe modifié avec succès");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldCheck} title="Mon profil" description="Vos informations et la sécurité de votre compte." />

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Fiche */}
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Ma fiche membre</CardTitle>
            <CardDescription>Informations gérées par votre tête de liste</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <MemberAvatar firstName={me.firstName} lastName={me.lastName} size="lg" />
              <div>
                <p className="text-lg font-bold">
                  {me.lastName} {me.firstName}
                </p>
                <div className="mt-1">
                  <RoleBadge role={me.role} />
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Identifiant de connexion</p>
                  <p className="text-sm font-medium tabular-nums">{me.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Registre</p>
                  <p className="text-sm font-medium">{me.registryName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border px-3.5 py-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Localité</p>
                  <p className="text-sm font-medium">{me.city || "Non renseignée"}</p>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
              Confidentialité : les autres membres ne peuvent pas voir le détail de vos finances, sauf si votre registre est configuré en « Transparence Totale ».
            </p>
          </CardContent>
        </Card>

        {/* Mot de passe */}
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" /> Changer mon mot de passe
            </CardTitle>
            <CardDescription>Choisissez un mot de passe fort et confidentiel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Mot de passe actuel</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <div className="space-y-2">
                <Label>Nouveau mot de passe</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" />
                <div className="grid gap-1.5 mt-1">
                  {rules.map((r) => (
                    <p key={r.label} className={`flex items-center gap-2 text-xs ${r.ok ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {r.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border shrink-0" />}
                      {r.label}
                    </p>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirmer</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !rules.every((r) => r.ok) || !confirm || !currentPassword}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Modifier mon mot de passe"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
