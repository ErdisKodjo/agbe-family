// ============================================================
// PGF — Formatage (montants FCFA, dates FR)
// ============================================================

export function formatMoney(amount: number): string {
  // Espace fine insécable (U+202F) : l'unité ne se sépare jamais du montant
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount) + "\u202F" + "FCFA";
}

export function formatMoneyShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}\u202FM`;
  if (abs >= 1_000) return `${(amount / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}\u202Fk`;
  return amount.toLocaleString("fr-FR");
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export function formatDateLong(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(d));
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function monthLabel(m?: number | null): string {
  if (m == null) return "—";
  return MONTHS_FR[Math.min(11, Math.max(0, m - 1))];
}

/** Tendance de % entre deux valeurs */
export function trend(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) /previous) * 100);
}
