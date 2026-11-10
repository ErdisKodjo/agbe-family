// ============================================================
// P1 — Unit of Work.
// Point de passage OBLIGATOIRE pour toute écriture multi-agrégats.
// (4 oublis de transaction corrigés en P0 dans ce repo.)
//
// Usage :
//   const result = await withTransaction(async (tx) => {
//     await tx.payment.updateMany({...});
//     await tx.transaction.create({...});
//     return ...;
//   });
// ============================================================
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(fn);
}
