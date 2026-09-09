// ============================================================
// PGF — Constantes métier (énumérations applicatives)
// ============================================================

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN", // Administrateur général de la plateforme
  HEAD: "HEAD", // Tête de liste (admin d'un registre)
  TREASURER: "TREASURER", // Trésorier
  MEMBER: "MEMBER", // Membre simple
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Administrateur Général",
  HEAD: "Tête de Liste",
  TREASURER: "Trésorier",
  MEMBER: "Membre",
};

export const ADMIN_ROLES: string[] = [ROLES.SUPER_ADMIN, ROLES.HEAD, ROLES.TREASURER];

// ------------------------------------------------------------
// Campagnes de cotisation
// ------------------------------------------------------------
export const CAMPAIGN_TYPES = {
  MONTHLY: "MONTHLY",
  OCCASIONAL: "OCCASIONAL",
} as const;

export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  MONTHLY: "Mensuelle (récurrente)",
  OCCASIONAL: "Occasionnelle (appel à fonds)",
};

export const CAMPAIGN_STATUSES = { ACTIVE: "ACTIVE", CLOSED: "CLOSED" } as const;

// ------------------------------------------------------------
// Paiements
// ------------------------------------------------------------
export const PAYMENT_STATUSES = { PENDING: "PENDING", VALIDATED: "VALIDATED", REJECTED: "REJECTED" } as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente de validation",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
};

export const PAYMENT_METHODS = {
  MOBILE_MONEY: "MOBILE_MONEY",
  CASH: "CASH",
  BANK: "BANK",
  OTHER: "OTHER",
} as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  MOBILE_MONEY: "Mobile Money",
  CASH: "Espèces",
  BANK: "Virement bancaire",
  OTHER: "Autre",
};

// ------------------------------------------------------------
// Trésorerie
// ------------------------------------------------------------
export const TRANSACTION_TYPES = { INCOME: "INCOME", EXPENSE: "EXPENSE" } as const;

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  INCOME: "Entrée (Recette)",
  EXPENSE: "Sortie (Dépense)",
};

export const INCOME_CATEGORIES: Record<string, string> = {
  COTISATION: "Cotisation",
  DON: "Don / Libéralité",
  VENTE: "Vente",
  REMBOURSEMENT: "Remboursement",
  PROJET: "Apport projet",
  AUTRE: "Autre recette",
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  ACHAT_MATERIEL: "Achat matériel",
  FRAIS_ORGANISATION: "Frais d'organisation",
  AIDE_SOCIALE: "Aide sociale",
  PROJET: "Dépense projet",
  REMBOURSEMENT: "Remboursement prêt",
  AUTRE: "Autre dépense",
};

export function allCategories(): Record<string, string> {
  return { ...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES };
}

// ------------------------------------------------------------
// Projets
// ------------------------------------------------------------
export const PROJECT_STATUSES = {
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planifié",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

export const PHASE_STATUSES = { PENDING: "PENDING", IN_PROGRESS: "IN_PROGRESS", DONE: "DONE" } as const;

export const PHASE_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  IN_PROGRESS: "En cours",
  DONE: "Terminée",
};

export const TASK_STATUSES = { TODO: "TODO", IN_PROGRESS: "IN_PROGRESS", DONE: "DONE" } as const;

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  DONE: "Terminée",
};

export const CONTRIBUTION_KINDS = { CASH: "CASH", IN_KIND: "IN_KIND" } as const;

export const CONTRIBUTION_KIND_LABELS: Record<string, string> = {
  CASH: "Numéraire",
  IN_KIND: "En nature",
};

// ------------------------------------------------------------
// Audit
// ------------------------------------------------------------
export const AUDIT_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  VALIDATE: "VALIDATE",
  REJECT: "REJECT",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
} as const;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  VALIDATE: "Validation",
  REJECT: "Rejet",
  LOGIN: "Connexion",
  LOGOUT: "Déconnexion",
};

// ------------------------------------------------------------
// Divers
// ------------------------------------------------------------
export const DEFAULT_PASSWORD = "Famille2026!";
export const SESSION_COOKIE = "pgf_session";
export const SESSION_DURATION_HOURS = 24 * 7; // 7 jours
