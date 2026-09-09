// ============================================================
// PGF — Journal d'audit (traçabilité « qui a modifié quoi »)
// ============================================================
import { db } from "@/lib/db";

export async function audit(
  memberId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: string
) {
  try {
    await db.auditLog.create({
      data: {
        memberId,
        action,
        entityType,
        entityId: entityId ?? null,
        details: details ?? null,
      },
    });
  } catch (e) {
    // L'audit ne doit jamais bloquer l'opération métier
    console.error("audit log error", e);
  }
}
