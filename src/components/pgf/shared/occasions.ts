// ============================================================
// PGF — Cotisations nommées : modèles d'événements partagés
// Utilisé par le dialogue de création (pré-remplissage), les
// cartes de campagnes, le suivi et le sélecteur d'encaissement.
// ============================================================
import {
  Flower2,
  HeartHandshake,
  Droplets,
  Baby,
  Stethoscope,
  GraduationCap,
  Tag,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

export interface OccasionTemplate {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Préfixe d'intitulé (finissant par un espace) — le bénéficiaire complète */
  name: string;
  description: string;
}

export const OCCASION_TEMPLATES: OccasionTemplate[] = [
  {
    id: "FUNERAILLES",
    label: "Funérailles",
    icon: Flower2,
    name: "Cotisation pour les funérailles de ",
    description: "Soutien exceptionnel à la famille endeuillée.",
  },
  {
    id: "MARIAGE",
    label: "Mariage",
    icon: HeartHandshake,
    name: "Cotisation pour le mariage de ",
    description: "Soutien au mariage du membre de la famille.",
  },
  {
    id: "BAPTEME",
    label: "Baptême",
    icon: Droplets,
    name: "Cotisation pour le baptême de ",
    description: "Cotisation pour le baptême de l'enfant.",
  },
  {
    id: "NAISSANCE",
    label: "Naissance",
    icon: Baby,
    name: "Cotisation pour la naissance de ",
    description: "Cadeau de bienvenue au nouveau-né.",
  },
  {
    id: "MALADIE",
    label: "Maladie / Accident",
    icon: Stethoscope,
    name: "Cotisation pour les soins de ",
    description: "Assistance médicale du membre.",
  },
  {
    id: "ETUDES",
    label: "Études",
    icon: GraduationCap,
    name: "Cotisation pour les études de ",
    description: "Aide à la scolarité de l'enfant.",
  },
  {
    id: "AUTRE",
    label: "Autre",
    icon: Tag,
    name: "",
    description: "",
  },
];

/** Clés d'occasion valides (validation côté API) */
export const OCCASION_KEYS = OCCASION_TEMPLATES.map((t) => t.id);

/** Icône d'une campagne occasionnelle (fallback mégaphone) */
export function occasionIcon(key?: string | null): LucideIcon {
  return OCCASION_TEMPLATES.find((t) => t.id === key)?.icon ?? Megaphone;
}

/** Libellé lisible du type d'événement */
export function occasionLabel(key?: string | null): string | null {
  return OCCASION_TEMPLATES.find((t) => t.id === key)?.label ?? null;
}

/** Normalisation d'intitulé pour la détection de doublons (client + serveur) */
export function normalizeCampaignName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
