"use client";
// ============================================================
// PGF — Composants partagés (cartes stats, helpers UI)
// ============================================================
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { avatarColor, initialsOf } from "@/lib/avatar";

// ---------- Carte statistique premium ----------
export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  tone = "primary",
  loading,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: "primary" | "gold" | "danger" | "neutral";
  loading?: boolean;
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-amber-500/15 text-amber-700",
    danger: "bg-rose-500/10 text-rose-600",
    neutral: "bg-secondary text-secondary-foreground",
  };
  return (
    <Card className={cn("pgf-stat-card border-border/70 shadow-sm hover:shadow-md transition-shadow")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted-foreground leading-tight">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-2" />
            ) : (
              <p className="text-2xl font-bold tracking-tight mt-1.5 truncate tabular-nums" title={value}>
                {value}
              </p>
            )}
            {hint && !loading && <p className="text-xs text-muted-foreground font-medium mt-1 truncate">{hint}</p>}
          </div>
          <div className={cn("rounded-xl p-2.5 shrink-0", tones[tone])}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- En-tête de vue ----------
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="rounded-xl bg-primary/10 text-primary p-2.5 hidden sm:block">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-balance">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// ---------- Avatar membre ----------
export function MemberAvatar({
  firstName,
  lastName,
  size = "default",
  className,
}: {
  firstName: string;
  lastName: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    default: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  return (
    <Avatar className={cn(sizes[size], className)}>
      <AvatarFallback className={cn(avatarColor(`${firstName}${lastName}`), "text-white font-semibold")}>
        {initialsOf(firstName, lastName)}
      </AvatarFallback>
    </Avatar>
  );
}

// ---------- Badge statut paiement ----------
export function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: "En attente", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
    VALIDATED: { label: "Validé", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
    REJECTED: { label: "Rejeté", className: "bg-rose-500/15 text-rose-600 border-rose-500/30" },
  };
  const s = map[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("font-medium", s.className)}>
      {s.label}
    </Badge>
  );
}

// ---------- Badge rôle ----------
export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; className: string }> = {
    SUPER_ADMIN: { label: "Admin Général", className: "bg-primary text-primary-foreground" },
    HEAD: { label: "Tête de Liste", className: "bg-amber-500/90 text-white" },
    TREASURER: { label: "Trésorier", className: "bg-sidebar-primary text-sidebar-primary-foreground" },
    MEMBER: { label: "Membre", className: "bg-secondary text-secondary-foreground" },
  };
  const s = map[role] ?? { label: role, className: "" };
  return <Badge className={cn("font-medium", s.className)}>{s.label}</Badge>;
}

// ---------- Barre de progression financement ----------
export function FundingBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2.5 rounded-full bg-secondary overflow-hidden", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-[width] duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ---------- Message « vide » ----------
export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-2xl bg-secondary p-4 mb-3">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
    </div>
  );
}

// ---------- Solde coloré ----------
export function MoneyText({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", value < 0 && "text-rose-600", className)}>{formatMoney(value)}</span>
  );
}
