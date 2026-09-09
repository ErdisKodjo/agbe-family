"use client";
// ============================================================
// PGF — Changement de mot de passe obligatoire (1ʳᵉ connexion)
// ============================================================
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { post } from "./api";
import { Loader2, KeyRound, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ChangePasswordScreen({ memberName }: { memberName: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const rules = [
    { label: "Au moins 8 caractères", ok: newPassword.length >= 8 },
    { label: "Une majuscule", ok: /[A-Z]/.test(newPassword) },
    { label: "Un chiffre", ok: /\d/.test(newPassword) },
    { label: "Différent de l'ancien", ok: newPassword.length > 0 && newPassword !== currentPassword },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    try {
      await post("/api/auth/change-password", { currentPassword, newPassword });
      toast.success("Mot de passe modifié. Redémarrage de la session…");
      setTimeout(() => window.location.reload(), 900);
    } catch (err: any) {
      toast.error(err.message || "Échec du changement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pgf-brand-gradient min-h-screen flex items-center justify-center p-6">
      <div className="pgf-dots absolute inset-0 opacity-40 pointer-events-none" />
      <Card className="w-full max-w-md relative shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 rounded-2xl bg-amber-500/15 text-amber-600 p-3 w-fit">
            <KeyRound className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl tracking-tight">Sécurisez votre compte</CardTitle>
          <CardDescription>
            Bonjour {memberName}. Pour votre première connexion, vous devez définir
            votre propre mot de passe personnel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Mot de passe actuel (par défaut)</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <div className="grid gap-1.5 mt-2">
                {rules.map((r) => (
                  <p
                    key={r.label}
                    className={`flex items-center gap-2 text-xs ${r.ok ? "text-emerald-600" : "text-muted-foreground"}`}
                  >
                    {r.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {r.label}
                  </p>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmer le nouveau mot de passe</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading || !rules.every((r) => r.ok) || !confirm}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Définir mon mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
