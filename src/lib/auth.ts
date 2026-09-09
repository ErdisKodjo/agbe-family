// ============================================================
// PGF — Authentification (scrypt + sessions httpOnly)
// ============================================================
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_DURATION_HOURS, ADMIN_ROLES } from "@/lib/constants";
import type { Member } from "@prisma/client";

// --- Hachage des mots de passe (scrypt, sel unique) ---
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

// --- Sessions ---
export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DURATION_HOURS * 3600 * 1000);
}

export async function createSession(memberId: string): Promise<string> {
  const token = newSessionToken();
  await db.session.create({
    data: { token, memberId, expiresAt: sessionExpiry() },
  });
  return token;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: SESSION_DURATION_HOURS * 3600,
  });
}

export async function clearSession(token: string) {
  await db.session.deleteMany({ where: { token } });
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Récupère le membre connecté (ou null) à partir du cookie de session. */
export async function getCurrentMember(): Promise<Member | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { member: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.member.isActive) return null;
  return session.member;
}

export function isAdmin(member: Member | null): boolean {
  if (!member) return false;
  return ADMIN_ROLES.includes(member.role);
}

/** Vérifie qu'un membre connecté a un rôle admin, sinon lève une erreur API. */
export async function requireAdmin(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) throw new AuthError("Non authentifié", 401);
  if (!isAdmin(member)) throw new AuthError("Accès réservé aux administrateurs", 403);
  return member;
}

export async function requireAuth(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) throw new AuthError("Non authentifié", 401);
  return member;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

// --- Utilitaires téléphone ---
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s().-]/g, "").trim();
}

export function isValidPhone(raw: string): boolean {
  const p = normalizePhone(raw);
  return /^\+\d{8,15}$/.test(p);
}


