// ============================================================
// AGBE Family — Amorçage du compte Admin Général (idempotent)
// Crée le registre racine + le SUPER_ADMIN uniquement si la base
// ne contient aucun membre. Tourne dans le conteneur (node:22-alpine).
//   ADMIN_PHONE     — numéro international de l'admin (déf. +22890000000)
//   ADMIN_PASSWORD  — mot de passe provisoire (déf. changé à la 1re connexion)
//   ADMIN_FIRST_NAME / ADMIN_LAST_NAME — nom affiché
// ============================================================
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const db = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const phone = (process.env.ADMIN_PHONE || "+22890000000").trim();
const password = process.env.ADMIN_PASSWORD || "AgbeAdmin@2026";
const firstName = process.env.ADMIN_FIRST_NAME || "Admin";
const lastName = process.env.ADMIN_LAST_NAME || "AGBE";

async function main() {
  const members = await db.member.count();
  if (members > 0) {
    console.log(`[bootstrap] ${members} membre(s) déjà présents — aucun amorçage nécessaire.`);
    return;
  }

  const registry = await db.registry.create({
    data: {
      name: "Famille AGBÉ — Registre Racine",
      description: "Registre principal créé automatiquement au premier démarrage.",
      isGlobal: true,
    },
  });

  const admin = await db.member.create({
    data: {
      registryId: registry.id,
      firstName,
      lastName,
      phone,
      role: "SUPER_ADMIN",
      passwordHash: hashPassword(password),
      mustChangePassword: true,
      position: "Administrateur Général",
    },
  });

  await db.auditLog.create({
    data: {
      memberId: admin.id,
      action: "CREATE",
      entityType: "Member",
      entityId: admin.id,
      details: `Amorçage : registre racine + compte Admin Général (${phone}) créés au premier démarrage.`,
    },
  });

  console.log(`[bootstrap] Compte Admin Général créé : ${phone} (mot de passe à changer à la 1re connexion).`);
}

main()
  .catch((e) => {
    console.error("[bootstrap] Erreur :", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
