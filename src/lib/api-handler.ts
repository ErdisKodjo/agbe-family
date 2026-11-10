// ============================================================
// P1 — Wrappers de routes (pattern Middleware/Decorator + DRY).
// Remplace le bloc identique répété dans ~20 routes :
//   try { const admin = await requireAdmin(); ... }
//   catch (e) { if (e?.status) return ...; console.error(e); return 500 }
//
// Usage :
//   export const PATCH = withAdmin(async (req, { admin, params }) => {
//     ... return NextResponse.json(...)
//   })
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth, AuthError } from "@/lib/auth";
import type { Member } from "@prisma/client";

type Ctx = { params: Record<string, string> };
type AdminHandler = (req: NextRequest, ctx: { admin: Member; params: Record<string, string> }) => Promise<NextResponse>;
type AuthHandler = (req: NextRequest, ctx: { member: Member; params: Record<string, string> }) => Promise<NextResponse>;

function resolveParams(params: unknown): Record<string, string> {
  // Next.js 15+ passe params en Promise ; on gère les deux formes.
  if (params && typeof (params as Promise<unknown>).then === "function") {
    return {} as Record<string, string>; // résolu avant par le wrapper
  }
  return (params as Record<string, string>) ?? {};
}

/** Enveloppe un handler réservé aux administrateurs. */
export function withAdmin(handler: AdminHandler) {
  return async function (req: NextRequest, ctx: Ctx & { params?: unknown }) {
    try {
      const admin = await requireAdmin();
      const params = ctx.params instanceof Promise ? await ctx.params : resolveParams(ctx.params);
      return await handler(req, { admin, params });
    } catch (e: unknown) {
      if (e instanceof AuthError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      if (e && typeof (e as { status?: number }).status === "number") {
        const err = e as { status: number; message?: string };
        return NextResponse.json({ error: err.message ?? "Erreur" }, { status: err.status });
      }
      console.error(e);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}

/** Enveloppe un handler nécessitant une authentification (membre ou admin). */
export function withAuth(handler: AuthHandler) {
  return async function (req: NextRequest, ctx: Ctx & { params?: unknown }) {
    try {
      const member = await requireAuth();
      const params = ctx.params instanceof Promise ? await ctx.params : resolveParams(ctx.params);
      return await handler(req, { member, params });
    } catch (e: unknown) {
      if (e instanceof AuthError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      if (e && typeof (e as { status?: number }).status === "number") {
        const err = e as { status: number; message?: string };
        return NextResponse.json({ error: err.message ?? "Erreur" }, { status: err.status });
      }
      console.error(e);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}
