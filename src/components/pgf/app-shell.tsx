"use client";
// ============================================================
// PGF — Coque applicative (barre latérale desktop + nav mobile)
// ============================================================
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "./shared/ui-bits";
import type { CurrentMember } from "./types";
import { post } from "./api";
import { initialsOf } from "@/lib/avatar";
import {
  LayoutDashboard,
  Users,
  Landmark,
  Wallet,
  FolderKanban,
  FileBarChart,
  ScrollText,
  Megaphone,
  Settings,
  LogOut,
  KeyRound,
  Network,
  MoreHorizontal,
  Landmark as Logo,
  Menu,
  ChevronRight,
} from "lucide-react";

export type ViewId =
  | "dashboard"
  | "registries"
  | "members"
  | "contributions"
  | "treasury"
  | "projects"
  | "reports"
  | "audit"
  | "announcements"
  | "my-contributions"
  | "my-projects"
  | "profile";

interface NavItem {
  id: ViewId;
  label: string;
  icon: any;
  adminOnly?: boolean;
  short?: string; // libellé court pour la barre mobile
}

const ADMIN_NAV: NavItem[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, short: "Accueil" },
  { id: "registries", label: "Registres", icon: Network, short: "Registres" },
  { id: "members", label: "Membres", icon: Users, short: "Membres" },
  { id: "contributions", label: "Cotisations", icon: Wallet, short: "Cotisations" },
  { id: "treasury", label: "Trésorerie", icon: Landmark, short: "Trésorerie" },
  { id: "projects", label: "Projets", icon: FolderKanban, short: "Projets" },
  { id: "announcements", label: "Annonces", icon: Megaphone, short: "Annonces" },
  { id: "reports", label: "Rapports & Exports", icon: FileBarChart, short: "Rapports" },
  { id: "audit", label: "Journal d'audit", icon: ScrollText, adminOnly: true, short: "Audit" },
];

const MEMBER_NAV: NavItem[] = [
  { id: "dashboard", label: "Mon tableau de bord", icon: LayoutDashboard, short: "Accueil" },
  { id: "my-contributions", label: "Mes cotisations", icon: Wallet, short: "Cotisations" },
  { id: "my-projects", label: "Mes projets", icon: FolderKanban, short: "Projets" },
  { id: "announcements", label: "Annonces", icon: Megaphone, short: "Annonces" },
];

const ADMIN_ROLES = ["SUPER_ADMIN", "HEAD", "TREASURER"];

export function AppShell({
  member,
  view,
  onNavigate,
  onLogout,
  children,
  pendingBadge,
}: {
  member: CurrentMember;
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  onLogout: () => void;
  children: React.ReactNode;
  pendingBadge?: number;
}) {
  const isAdmin = ADMIN_ROLES.includes(member.role);
  const nav = isAdmin ? ADMIN_NAV : MEMBER_NAV;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Barre mobile : 4 entrées principales + 5e cellule (menu « Plus » admin / Profil membre)
  const primaryNav = nav.slice(0, 4);
  const moreNav = nav.slice(4);
  const moreActive = moreNav.some((i) => i.id === view) || (!isAdmin && view === "profile");

  const logout = async () => {
    try {
      await post("/api/auth/logout", {});
    } catch {}
    onLogout();
  };

  const currentLabel = nav.find((n) => n.id === view)?.label ?? "";

  return (
    <div className="min-h-screen pgf-bg flex flex-col">
      <div className="flex flex-1">
        {/* ---------- Sidebar desktop ---------- */}
        <aside className="hidden lg:flex w-64 flex-col bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
          <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border/60">
            <div className="rounded-xl bg-sidebar-primary p-2">
              <Logo className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[15px] tracking-tight text-white">AGBE Family</p>
              <p className="text-[11px] text-sidebar-foreground/60">Gestion Familiale · PGF</p>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto pgf-scroll">
            <p className="px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {isAdmin ? "Espace Administration" : "Espace Membre"}
            </p>
            {nav
              .filter((n) => !n.adminOnly || isAdmin)
              .map((item) => {
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative",
                      active
                        ? "bg-sidebar-accent text-white shadow-sm"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-sidebar-primary" />}
                    <item.icon className="w-[18px] h-[18px]" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.id === "contributions" && pendingBadge && pendingBadge > 0 && isAdmin && (
                      <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 min-w-5">
                        {pendingBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            {!isAdmin && (
              <button
                onClick={() => onNavigate("profile")}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  view === "profile"
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
                )}
              >
                <KeyRound className="w-[18px] h-[18px]" />
                Mon profil
              </button>
            )}
          </nav>

          <div className="p-3 border-t border-sidebar-border/60">
            <div className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-sidebar-accent/50 transition-colors">
              <Avatar className="h-9 w-9 border border-white/10">
                <AvatarFallback className="bg-amber-500/80 text-white text-xs font-semibold">
                  {initialsOf(member.firstName, member.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {member.firstName} {member.lastName}
                </p>
                <p className="text-[11px] text-sidebar-foreground/60 truncate">{member.registryName}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* ---------- Contenu ---------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* En-tête mobile */}
          <header className="lg:hidden sticky top-0 z-40 bg-sidebar text-white border-b border-sidebar-border/50">
            <div className="flex items-center gap-3 px-4 h-14">
              <div className="rounded-lg bg-sidebar-primary p-1.5">
                <Logo className="w-4 h-4 text-sidebar-primary-foreground" />
              </div>
              <p className="font-bold text-sm">AGBE Family</p>
              <div className="flex-1" />
              <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 bg-sidebar-accent">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-amber-500/80 text-white text-[10px] font-semibold">
                        {initialsOf(member.firstName, member.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <Menu className="w-4 h-4 text-white/70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="font-semibold">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground font-normal">{member.phone}</p>
                    <div className="mt-1.5">
                      <RoleBadge role={member.role} />
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!isAdmin && (
                    <DropdownMenuItem onClick={() => onNavigate("profile")}>
                      <KeyRound className="w-4 h-4 mr-2" /> Mon profil
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={logout} className="text-rose-600 focus:text-rose-600">
                    <LogOut className="w-4 h-4 mr-2" /> Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Fil d'ariane desktop */}
          <div className="hidden lg:flex items-center gap-1.5 px-8 pt-6 text-sm text-muted-foreground">
            <span className="text-xs uppercase tracking-wide font-semibold">{isAdmin ? "Administration" : "Espace membre"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-medium text-foreground">{currentLabel}</span>
          </div>

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 lg:py-6 pb-24 lg:pb-8 max-w-[1400px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>

      {/* ---------- Nav bas mobile ---------- */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-16">
          {primaryNav.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 relative",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{item.short ?? item.label}</span>
                {item.id === "contributions" && pendingBadge && pendingBadge > 0 && isAdmin && (
                  <span className="absolute top-2 right-[22%] rounded-full bg-amber-500 text-white text-[9px] font-bold px-1 min-w-4 h-4 flex items-center justify-center">
                    {pendingBadge}
                  </span>
                )}
              </button>
            );
          })}

          {/* 5e cellule : menu « Plus » (admin) ou Profil (membre) */}
          {isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 relative outline-none",
                    moreActive ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-label="Plus de vues"
                >
                  {moreActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                  <MoreHorizontal className="w-5 h-5" />
                  <span className="text-[10px] font-medium leading-none">Plus</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56 mb-2">
                {moreNav.map((item) => (
                  <DropdownMenuItem key={item.id} onClick={() => onNavigate(item.id)}>
                    <item.icon className="w-4 h-4 mr-2" /> {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={() => onNavigate("profile")}
              className={cn(
                "flex flex-col items-center justify-center gap-1 relative",
                view === "profile" ? "text-primary" : "text-muted-foreground"
              )}
            >
              {view === "profile" && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              <KeyRound className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">Profil</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
