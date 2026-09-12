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
      <div className="pgf-brand-gradient pgf-brand-enter relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
        <div className="pgf-dots absolute inset-0 opacity-60" />
        {/* Filigrane décoratif (emblème rond, coin bas-droit, hors zone de lecture) */}
        <Image
          src="/logo-round-512.webp"
          alt=""
          width={380}
          height={380}
          aria-hidden
          loading="eager"
          className="absolute -right-16 -bottom-24 opacity-[0.10] pointer-events-none select-none"
        />
        <div className="relative">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-512.webp"
              alt="Emblème Agbetossou : monogramme AG or et bleu nuit, couronne de laurier, cœur familial et devise Unité · Amour · Respect · Héritage"
              width={84}
              height={84}
              priority
              loading="eager"
              className="rounded-2xl ring-1 ring-white/25 shadow-[0_10px_36px_rgba(0,0,0,0.45)] shrink-0"
            />
            <div>
              <p className="font-bold text-xl tracking-tight">AGBE Family</p>
              <p className="text-xs text-white/60">Plateforme de Gestion Familiale</p>
              <p className="text-[11px] text-amber-300/90 tracking-wide mt-1">Unité · Amour · Respect · Héritage</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-balance">
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

        <div className="relative flex items-center gap-2 text-xs text-white/65">
          <ShieldCheck className="w-4 h-4 text-amber-300" />
          Connexion chiffrée · Journal d'audit complet · Données hébergées en privé
        </div>
      </div>

      {/* ---- Formulaire ---- */}
      <div className="pgf-bg flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="pgf-rise lg:hidden flex items-center gap-3 mb-8">
            <Image
              src="/logo-128.webp"
              alt="Emblème AGBE Family : monogramme AG, laurier et cœur familial"
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
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Mot de passe oublié ? Contactez l'administrateur de votre registre familial.
          </p>
          <p className="text-center text-xs text-muted-foreground mt-2">
            © {new Date().getFullYear()} AGBE Family · Plateforme de Gestion Familiale (PGF)
          </p>
        </div>
      </div>
    </div>
  );
}
