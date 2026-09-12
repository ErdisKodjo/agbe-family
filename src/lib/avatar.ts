// ============================================================
// PGF — Helpers d'avatar (sûrs côté client, sans dépendance)
// ============================================================

export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function avatarColor(seed: string): string {
  const colors = [
    "bg-blue-900",
    "bg-amber-600",
    "bg-teal-600",
    "bg-rose-600",
    "bg-orange-600",
    "bg-lime-700",
    "bg-cyan-700",
    "bg-fuchsia-700",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(h) % colors.length];
}
