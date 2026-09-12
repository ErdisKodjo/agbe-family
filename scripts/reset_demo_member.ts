// Réinitialise le compte membre démo (+22890202020) à son état documenté :
// mot de passe « Famille2026! » + changement obligatoire à la première connexion.
// Usage : npx tsx scripts/reset_demo_member.ts
import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  await db.session.deleteMany({ where: { member: { phone: "+22890202020" } } });
  const m = await db.member.update({
    where: { phone: "+22890202020" },
    data: { passwordHash: hashPassword("Famille2026!"), mustChangePassword: true },
    select: { firstName: true, lastName: true, phone: true, role: true, mustChangePassword: true },
  });
  console.log("Compte membre démo réinitialisé :", JSON.stringify(m));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
