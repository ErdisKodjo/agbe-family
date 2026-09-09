"use client";
// ============================================================
// PGF — Écran de connexion (téléphone international + mot de passe)
// ============================================================
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { post } from "./api";
import type { CurrentMember } from "./types";
import { Loader2, Phone, Lock, ShieldCheck, Users, Landmark, FolderKanban, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function LoginScreen({ onLogin }: { onLogin: (m: CurrentMember) => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) return;
    setLoading(true);
    try {
      const res = await post<{ member: CurrentMember }>("/api/auth/login", { phone, password });
      toast.success(`Bienvenue, ${res.member.firstName} !`);
      onLogin(res.member);
    } catch (err: any) {
      toast.error(err.message || "Connexion impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ---- Panneau de marque ---- */}
      <div className="pgf-brand-gradient relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
        <div className="pgf-dots absolute inset-0 opacity-60" />
        {/* Filigrane décoratif (emblème géant) */}
        <Image
          src="/logo-512.webp"
          alt=""
          width={460}
          height={460}
          aria-hidden
          className="absolute -right-24 top-1/2 -translate-y-1/2 opacity-[0.15] pointer-events-none select-none"
        />
        <div className="relative">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-512.webp"
              alt="Emblème AGBETOSSOU : arbre de vie entre deux mains, famille bénie de rayons de lumière"
              width={84}
              height={84}
              priority
              className="rounded-2xl ring-1 ring-white/25 shadow-[0_10px_36px_rgba(0,0,0,0.45)] shrink-0"
            />
            <div>
              <p className="font-bold text-xl tracking-tight">AGBE Family</p>
              <p className="text-xs text-white/60">Plateforme de Gestion Familiale</p>
              <p className="text-[11px] text-amber-300/90 tracking-wide mt-1">AGBE TƆ SƆ · La vie appartient à Dieu</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            La fortune de votre famille,
            <span className="text-amber-300"> enfin centralisée.</span>
          </h1>
          <p className="mt-4 text-white/70 leading-relaxed">
            Membres, cotisations, trésorerie et projets — un espace unique, sécurisé et
            transparent pour toute la famille élargie, où qu'elle soit.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { icon: Users, label: "Membres & registres" },
              { icon: Landmark, label: "Trésorerie en direct" },
              { icon: FolderKanban, label: "Projets & chantiers" },
            ].map((f) => (
              <div key={f.label} className="rounded-xl bg-white/5 border border-white/10 p-3 backdrop-blur-sm">
                <f.icon className="w-5 h-5 text-amber-300 mb-2" />
                <p className="text-[11px] text-white/75 leading-snug">{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-white/50">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Connexion chiffrée · Journal d'audit complet · Données hébergées en privé
        </div>
      </div>

      {/* ---- Formulaire ---- */}
      <div className="pgf-bg flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <Image
              src="/logo-128.webp"
              alt="Emblème AGBE Family"
              width={52}
              height={52}
              priority
              className="rounded-xl ring-1 ring-border shrink-0"
            />
            <div>
              <p className="font-bold tracking-tight">AGBE Family</p>
              <p className="text-xs text-muted-foreground">Plateforme de Gestion Familiale</p>
            </div>
          </div>

          <Card className="border-border/70 shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="text-2xl tracking-tight">Connexion</CardTitle>
              <CardDescription>
                Utilisez votre numéro de téléphone (format international) et votre mot de passe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Numéro de téléphone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+228 90 12 34 56"
                      className="pl-9"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-9 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Masquer" : "Afficher"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 text-[15px]" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Se connecter"}
                </Button>
              </form>

              <div className="mt-6 rounded-xl border border-dashed border-border bg-secondary/40 p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Accès de démonstration</p>
                <div className="grid gap-2 text-xs">
                  <button
                    type="button"
                    className="flex items-center justify-between rounded-lg bg-card border px-3 py-2 hover:border-primary/50 transition-colors text-left"
                    onClick={() => {
                      setPhone("+22890101010");
                      setPassword("Admin@2026");
                    }}
                  >
                    <span className="font-medium">👑 Administrateur Général</span>
                    <span className="text-muted-foreground tabular-nums">+22890101010</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-between rounded-lg bg-card border px-3 py-2 hover:border-primary/50 transition-colors text-left"
                    onClick={() => {
                      setPhone("+22890202020");
                      setPassword("Famille2026!");
                    }}
                  >
                    <span className="font-medium">👤 Membre (1ʳᵉ connexion)</span>
                    <span className="text-muted-foreground tabular-nums">+22890202020</span>
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2.5">
                  Le compte membre illustre le changement de mot de passe obligatoire à la première connexion.
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} AGBE Family · Plateforme de Gestion Familiale (PGF)
          </p>
        </div>
      </div>
    </div>
  );
}
