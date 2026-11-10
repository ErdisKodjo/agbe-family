// ============================================================
// P1 — Schémas de validation zod.
// zod est installé (package.json) mais n'était JAMAIS utilisé.
// Ces schémas remplacent les `String(body.x)`, `Number(body.x)`
// manuels et les `any`. Validation côté serveur, messages clairs.
//
// Usage :
//   const parsed = ValidatePaymentActionSchema.safeParse(await req.json());
//   if (!parsed.success) return validationError(parsed.error);
//   const { action } = parsed.data;
// ============================================================
import { z } from "zod";
import { NextResponse } from "next/server";

// --- Paiements ---
export const ValidatePaymentActionSchema = z.object({
  action: z.enum(["VALIDATE", "REJECT"], {
    errorMap: () => ({ message: "Action invalide (VALIDATE ou REJECT)" }),
  }),
});

export const RecordPaymentSchema = z.object({
  amount: z.coerce.number().positive("Montant invalide"),
  campaignId: z.string().cuid().nullable().optional(),
  memberId: z.string().cuid().optional(),
  method: z.enum(["MOBILE_MONEY", "CASH", "BANK", "OTHER"]).default("MOBILE_MONEY"),
  reference: z.string().max(100).optional(),
  proofUrl: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  direct: z.boolean().default(false),
});

// --- Campagnes de cotisation ---
export const CreateCampaignSchema = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  type: z.enum(["MONTHLY", "OCCASIONAL"]),
  registryId: z.string().cuid("Registre invalide"),
  description: z.string().max(2000).optional(),
  amount: z.coerce.number().min(0).default(0),
  targetAmount: z.coerce.number().min(0).default(0),
  allowCustom: z.boolean().optional(),
  dueDay: z.coerce.number().int().min(1).max(28).default(5),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
  periodYear: z.coerce.number().int().min(2000).max(2100).optional(),
  occasionKey: z
    .enum(["FUNERAILLES", "MARIAGE", "BAPTEME", "NAISSANCE", "MALADIE", "ETUDES", "AUTRE"])
    .optional(),
  beneficiaryMemberId: z.string().cuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  publishAnnouncement: z.boolean().optional(),
  pledges: z
    .array(
      z.object({
        memberId: z.string().cuid(),
        amountDue: z.coerce.number().min(0).default(0),
      })
    )
    .optional(),
});

// --- Membres ---
export const CreateMemberSchema = z.object({
  firstName: z.string().min(1, "Prénom requis").max(100),
  lastName: z.string().min(1, "Nom requis").max(100),
  phone: z.string().min(8, "Téléphone invalide").max(20),
  registryId: z.string().cuid("Registre invalide"),
  role: z.enum(["SUPER_ADMIN", "HEAD", "TREASURER", "MEMBER"]).default("MEMBER"),
  city: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  password: z.string().min(6).optional(),
});

// --- Trésorerie (journal de caisse) ---
export const CreateTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"], { errorMap: () => ({ message: "Type de flux invalide" }) }),
  label: z.string().min(1, "Libellé requis").max(200),
  amount: z.coerce.number().positive("Montant invalide"),
  category: z.string().min(1).max(50),
  registryId: z.string().cuid("Registre invalide"),
  attachmentUrl: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  date: z.string().optional(),
});

// --- Apports projet ---
export const RecordProjectContributionSchema = z.object({
  memberId: z.string().cuid().optional(),
  amount: z.coerce.number().min(0).default(0),
  kind: z.enum(["CASH", "IN_KIND"]).default("CASH"),
  description: z.string().max(500).optional(),
  date: z.string().optional(),
});

/** Convertit une erreur zod en réponse HTTP 400 lisible. */
export function validationError(error: z.ZodError): NextResponse {
  const issues = error.issues.map((i) => `${i.path.join(".") || "corps"} : ${i.message}`);
  return NextResponse.json(
    { error: "Données invalides", details: issues },
    { status: 400 }
  );
}
