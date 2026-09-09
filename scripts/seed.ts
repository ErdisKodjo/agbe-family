// ============================================================
// PGF — Jeu de données de démonstration « Famille AGBÉ »
// Exécution : bun run scripts/seed.ts
// ============================================================
import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("🧹 Nettoyage…");
  await db.session.deleteMany();
  await db.auditLog.deleteMany();
  await db.payment.deleteMany();
  await db.contributionPledge.deleteMany();
  await db.contributionCampaign.deleteMany();
  await db.transaction.deleteMany();
  await db.projectContribution.deleteMany();
  await db.projectTask.deleteMany();
  await db.projectPhase.deleteMany();
  await db.project.deleteMany();
  await db.announcement.deleteMany();
  await db.member.deleteMany();
  await db.registry.deleteMany();

  console.log("🏗️  Création des registres…");
  const brancheNord = await db.registry.create({
    data: { name: "Famille AGBÉ — Branche Nord (Lomé)", description: "Descendants de l'aïeul Kossi AGBÉ, branche installée à Lomé et environs.", transparency: false },
  });
  const brancheSud = await db.registry.create({
    data: { name: "Famille AGBÉ — Branche Sud (Kara)", description: "Branche du Nord-Togo établie autour de Kara et Kpimé.", transparency: false },
  });
  const comite = await db.registry.create({
    data: { name: "Comité Organisateur — Mariage Jean & Aïcha", description: "Registre ad hoc pour l'organisation du mariage de septembre 2026.", transparency: true },
  });

  console.log("👥 Création des membres…");
  interface M { first: string; last: string; phone: string; city: string; position?: string; role?: string; pwd?: string; mustChange?: boolean; reg: string }
  const members: M[] = [
    { first: "Éric", last: "AGBÉ", phone: "+22890101010", city: "Lomé", position: "Administrateur Général", role: "SUPER_ADMIN", pwd: "Admin@2026", mustChange: false, reg: brancheNord.id },
    { first: "Awa", last: "AGBÉ", phone: "+22890101011", city: "Lomé", position: "Aînée de la branche Nord", role: "HEAD", pwd: "Tete@2026", mustChange: false, reg: brancheNord.id },
    { first: "Koffi", last: "AGBÉ", phone: "+22890101012", city: "Lomé", position: "Trésorier de la famille", role: "TREASURER", pwd: "Tresor@2026", mustChange: false, reg: brancheNord.id },
    { first: "Kossi", last: "AGBÉ", phone: "+22890202020", city: "Lomé", position: "Cadet", reg: brancheNord.id },
    { first: "Marie", last: "AGBÉ", phone: "+22890101014", city: "Lomé", position: "Cousine", reg: brancheNord.id },
    { first: "Jean", last: "AGBÉ", phone: "+22890101015", city: "Lomé", position: "Futur marié", reg: brancheNord.id },
    { first: "Adjovi", last: "AGBÉ", phone: "+22890101016", city: "Tsévié", position: "Oncle", reg: brancheNord.id },
    { first: "Sika", last: "AGBÉ", phone: "+22890101017", city: "Lomé", position: "Nièce", reg: brancheNord.id },
    { first: "Yao", last: "AGBÉ", phone: "+22890101018", city: "Aného", position: "Cousin", reg: brancheNord.id },
    { first: "Akouvi", last: "AGBÉ", phone: "+22890101019", city: "Lomé", position: "Tante", reg: brancheNord.id },
    { first: "Sénam", last: "AGBÉ", phone: "+22890101020", city: "Tsévié", position: "Cousine", reg: brancheNord.id },
    { first: "Bissiaka", last: "AGBÉ", phone: "+22890303030", city: "Kara", position: "Aîné de la branche Sud", role: "HEAD", pwd: "Nord@2026", mustChange: false, reg: brancheSud.id },
    { first: "Pitalou", last: "AGBÉ", phone: "+22890303031", city: "Kara", position: "Oncle", reg: brancheSud.id },
    { first: "Essohana", last: "AGBÉ", phone: "+22890303032", city: "Kpimé", position: "Cousine", reg: brancheSud.id },
    { first: "Bana", last: "AGBÉ", phone: "+22890303033", city: "Kara", position: "Cousin", reg: brancheSud.id },
    { first: "Léonie", last: "AGBÉ", phone: "+22890303034", city: "Sokodé", position: "Tante", reg: brancheSud.id },
    { first: "Kodjo", last: "AGBÉ", phone: "+22890303035", city: "Kara", position: "Neveu", reg: brancheSud.id },
    { first: "Rachidatou", last: "MOUSSA", phone: "+22890404040", city: "Lomé", position: "Témoin de la mariée", reg: comite.id },
    { first: "Ibrahim", last: "MOUSSA", phone: "+22890404041", city: "Lomé", position: "Frère de la mariée", reg: comite.id },
    { first: "Fati", last: "ABDOULAYE", phone: "+22890404042", city: "Lomé", position: "Organisatrice", reg: comite.id },
  ];

  const created: Record<string, any> = {};
  for (const m of members) {
    const member = await db.member.create({
      data: {
        firstName: m.first,
        lastName: m.last,
        phone: m.phone,
        city: m.city,
        position: m.position ?? null,
        registryId: m.reg,
        role: m.role ?? "MEMBER",
        passwordHash: hashPassword(m.pwd ?? "Famille2026!"),
        mustChangePassword: m.mustChange ?? (m.pwd ? false : true),
      },
    });
    created[m.phone] = member;
  }

  await db.registry.update({ where: { id: brancheNord.id }, data: { headMemberId: created["+22890101011"].id } });
  await db.registry.update({ where: { id: brancheSud.id }, data: { headMemberId: created["+22890303030"].id } });
  await db.registry.update({ where: { id: comite.id }, data: { headMemberId: created["+22890101015"].id } });

  const admin = created["+22890101010"];
  const tresorier = created["+22890101012"];

  console.log("💰 Campagnes de cotisation…");
  const MONTHS = [
    { month: 7, year: 2026 },
    { month: 8, year: 2026 },
    { month: 9, year: 2026 },
  ];
  for (const { month, year } of MONTHS) {
    const campaign = await db.contributionCampaign.create({
      data: {
        name: `Cotisation Mensuelle ${new Date(year, month - 1).toLocaleDateString("fr-FR", { month: "long" })} ${year}`,
        description: "Cotisation mensuelle ordinaire de la famille AGBÉ (branche Nord).",
        type: "MONTHLY",
        amount: 5000,
        dueDay: 5,
        periodMonth: month,
        periodYear: year,
        registryId: brancheNord.id,
        status: month === 9 ? "ACTIVE" : "CLOSED",
        pledges: {
          create: Object.values(created)
            .filter((m: any) => m.registryId === brancheNord.id && m.isActive)
            .map((m: any) => ({ memberId: m.id, amountDue: 5000 })),
        },
      },
    });
    const nord = Object.values(created).filter((m: any) => m.registryId === brancheNord.id);
    const payerCount = month === 9 ? 6 : nord.length - 2;
    for (let i = 0; i < payerCount; i++) {
      const m = nord[i];
      const isPending = month === 9 && i >= 4;
      const payment = await db.payment.create({
        data: {
          campaignId: campaign.id,
          memberId: m.id,
          amount: 5000,
          method: i % 3 === 0 ? "CASH" : "MOBILE_MONEY",
          reference: `TM-${year}${String(month).padStart(2, "0")}-${1000 + i}`,
          status: isPending ? "PENDING" : "VALIDATED",
          paidAt: new Date(year, month - 1, month === 9 ? 2 + i : 3 + (i % 8)),
          validatedAt: isPending ? null : new Date(year, month - 1, 6),
          validatedById: isPending ? null : tresorier.id,
        },
      });
      if (!isPending) {
        await db.transaction.create({
          data: {
            registryId: brancheNord.id,
            type: "INCOME",
            date: payment.paidAt,
            label: `Cotisation — ${m.firstName} ${m.lastName} (${campaign.name})`,
            category: "COTISATION",
            amount: 5000,
            recordedById: tresorier.id,
            note: `Paiement #${payment.id} validé`,
          },
        });
      }
    }
  }

  const mariage = await db.contributionCampaign.create({
    data: {
      name: "Cotisation Mariage Jean & Aïcha",
      description: "Appel à fonds pour l'organisation du mariage de Jean AGBÉ et Aïcha MOUSSA (26 septembre 2026). Montants répartis par palier.",
      type: "OCCASIONAL",
      targetAmount: 850000,
      allowCustom: true,
      registryId: comite.id,
      status: "ACTIVE",
      startDate: new Date(2026, 7, 1),
      endDate: new Date(2026, 8, 20),
      pledges: {
        create: [
          { memberId: created["+22890101015"].id, amountDue: 150000 },
          { memberId: created["+22890101016"].id, amountDue: 100000 },
          { memberId: created["+22890101011"].id, amountDue: 50000 },
          { memberId: created["+22890101010"].id, amountDue: 50000 },
          { memberId: created["+22890101012"].id, amountDue: 50000 },
          { memberId: created["+22890404040"].id, amountDue: 50000 },
          { memberId: created["+22890404041"].id, amountDue: 50000 },
          { memberId: created["+22890404042"].id, amountDue: 50000 },
          { memberId: created["+22890101014"].id, amountDue: 10000 },
          { memberId: created["+22890101017"].id, amountDue: 10000 },
          { memberId: created["+22890101018"].id, amountDue: 10000 },
          { memberId: created["+22890101019"].id, amountDue: 10000 },
          { memberId: created["+22890202020"].id, amountDue: 10000 },
          { memberId: created["+22890303031"].id, amountDue: 25000 },
          { memberId: created["+22890303033"].id, amountDue: 10000 },
        ],
      },
    },
  });
  const mariagePays: [string, number, string][] = [
    ["+22890101015", 150000, "VALIDATED"],
    ["+22890101011", 50000, "VALIDATED"],
    ["+22890101012", 50000, "VALIDATED"],
    ["+22890101010", 50000, "VALIDATED"],
    ["+22890404040", 30000, "VALIDATED"],
    ["+22890101016", 100000, "PENDING"],
    ["+22890101014", 10000, "VALIDATED"],
  ];
  for (const [phone, amount, status] of mariagePays) {
    const m = created[phone];
    const payment = await db.payment.create({
      data: {
        campaignId: mariage.id,
        memberId: m.id,
        amount,
        method: "MOBILE_MONEY",
        reference: `WV-${phone.slice(-4)}-${amount}`,
        status,
        paidAt: new Date(2026, 8, 1 + Math.floor(Math.random() * 6)),
        validatedAt: status === "VALIDATED" ? new Date(2026, 8, 3) : null,
        validatedById: status === "VALIDATED" ? tresorier.id : null,
      },
    });
    if (status === "VALIDATED") {
      await db.transaction.create({
        data: {
          registryId: comite.id,
          type: "INCOME",
          date: payment.paidAt,
          label: `Cotisation mariage — ${m.firstName} ${m.lastName}`,
          category: "COTISATION",
          amount,
          recordedById: tresorier.id,
        },
      });
    }
  }

  console.log("🏦 Trésorerie…");
  const tx = (registryId: string, type: string, date: Date, label: string, category: string, amount: number) =>
    db.transaction.create({ data: { registryId, type, date, label, category, amount, recordedById: tresorier.id } });

  for (let i = 5; i >= 1; i--) {
    const d = new Date(2026, 8 - i, 12);
    await tx(brancheNord.id, "INCOME", d, "Cotisations collectées du mois (branche Nord)", "COTISATION", 55000 - i * 2000);
    if (i % 2 === 0) {
      await tx(brancheSud.id, "INCOME", d, "Cotisations collectées du mois (branche Sud)", "COTISATION", 30000);
      await tx(brancheSud.id, "EXPENSE", new Date(2026, 8 - i, 18), "Aide sociale — frais hospitalisation M. Pitalou", "AIDE_SOCIALE", 75000);
    }
  }
  await tx(brancheNord.id, "INCOME", new Date(2026, 3, 5), "Don anonyme pour la famille", "DON", 100000);
  await tx(brancheNord.id, "INCOME", new Date(2026, 6, 15), "Vente de pagnés au stand familial", "VENTE", 45000);
  await tx(brancheNord.id, "EXPENSE", new Date(2026, 4, 10), "Achat de 2 tables + 20 chaises (réunions)", "ACHAT_MATERIEL", 95000);
  await tx(brancheNord.id, "EXPENSE", new Date(2026, 6, 20), "Frais d'organisation — fête des mères", "FRAIS_ORGANISATION", 60000);
  await tx(brancheNord.id, "EXPENSE", new Date(2026, 7, 14), "Aide sociale — rentrée scolaire de 3 orphelins", "AIDE_SOCIALE", 150000);
  await tx(comite.id, "EXPENSE", new Date(2026, 8, 2), "Acompte salle des fêtes « Le Jardin d'Ébène »", "FRAIS_ORGANISATION", 200000);
  await tx(comite.id, "EXPENSE", new Date(2026, 8, 4), "Achat décorations et invitations", "ACHAT_MATERIEL", 85000);

  console.log("🏗️ Projet « Construction Puits de Village »…");
  const puits = await db.project.create({
    data: {
      name: "Construction Puits de Village",
      description: "Forage d'un puits moderne à Kpimé pour alimenter le village et les familles environnantes.",
      registryId: brancheSud.id,
      startDate: new Date(2026, 5, 1),
      endDate: new Date(2026, 10, 30),
      budget: 1500000,
      status: "IN_PROGRESS",
    },
  });

  const phasesData = [
    { name: "Étude & Acquisition du terrain", progress: 100, budget: 200000 },
    { name: "Forage", progress: 60, budget: 700000 },
    { name: "Pompe & Équipement", progress: 0, budget: 400000 },
    { name: "Clôture & Aménagement", progress: 0, budget: 200000 },
  ];
  const phases: any[] = [];
  for (let i = 0; i < phasesData.length; i++) {
    phases.push(
      await db.projectPhase.create({
        data: {
          projectId: puits.id,
          name: phasesData[i].name,
          position: i,
          progress: phasesData[i].progress,
          budget: phasesData[i].budget,
          status: phasesData[i].progress >= 100 ? "DONE" : phasesData[i].progress > 0 ? "IN_PROGRESS" : "PENDING",
        },
      })
    );
  }

  const tasksData: [string, string | null, string | null, string, string | null][] = [
    ["Finaliser le rapport du géomètre", phases[0].id, created["+22890303030"].id, "DONE", null],
    ["Signer le bail du terrain communal", phases[0].id, created["+22890101010"].id, "DONE", null],
    ["Achat ciment — 20 sacs", phases[1].id, created["+22890303031"].id, "IN_PROGRESS", "2026-09-15"],
    ["Coordonner l'équipe de forage", phases[1].id, created["+22890303033"].id, "IN_PROGRESS", "2026-09-20"],
    ["Commander la pompe solaire", phases[2].id, created["+22890101012"].id, "TODO", "2026-10-05"],
    ["Comparer les devis de clôture", phases[3].id, null, "TODO", "2026-10-20"],
  ];
  for (const [title, phaseId, assigneeId, status, due] of tasksData) {
    await db.projectTask.create({
      data: { projectId: puits.id, title, phaseId, assigneeId, status, dueDate: due ? new Date(due) : null },
    });
  }

  const contribs: [string, number, string, string][] = [
    ["+22890101010", 300000, "CASH", "Apport initial personnel"],
    ["+22890303030", 250000, "CASH", "Apport branche Sud"],
    ["+22890303031", 100000, "IN_KIND", "10 sacs de ciment + transport"],
    ["+22890101011", 150000, "CASH", "Apport pour le forage"],
    ["+22890101016", 50000, "CASH", "Soutien au projet"],
    ["+22890101012", 100000, "CASH", "Avance sur la pompe"],
    ["+22890202020", 25000, "CASH", "Premier apport du cadet"],
  ];
  for (const [phone, amount, kind, description] of contribs) {
    const m = created[phone];
    await db.projectContribution.create({
      data: { projectId: puits.id, memberId: m.id, amount, kind, description, date: new Date(2026, 6, 10) },
    });
    if (kind === "CASH") {
      await db.transaction.create({
        data: {
          registryId: brancheSud.id,
          type: "INCOME",
          date: new Date(2026, 6, 10),
          label: `Apport projet « Construction Puits de Village » — ${m.firstName} ${m.lastName}`,
          category: "PROJET",
          amount,
          recordedById: tresorier.id,
        },
      });
    }
  }
  await tx(brancheSud.id, "EXPENSE", new Date(2026, 5, 20), "Honoraires géomètre & bureau d'études", "PROJET", 180000);
  await tx(brancheSud.id, "EXPENSE", new Date(2026, 7, 8), "Acompte entreprise de forage (40 %)", "PROJET", 280000);
  await tx(brancheSud.id, "EXPENSE", new Date(2026, 8, 1), "Matériaux — gravier et fer à béton", "PROJET", 120000);

  console.log("📣 Annonces…");
  await db.announcement.create({
    data: {
      title: "Assemblée générale de septembre le 20 à Lomé",
      content: "Chers membres, l'assemblée générale trimestrielle se tiendra le dimanche 20 septembre 2026 à 10h au domicile de Tante Akouvi (quartier Agbalépédogan). Ordre du jour : situation de trésorerie, avancement du puits de Kpimé et préparation du mariage de Jean & Aïcha. Merci de confirmer votre présence auprès de la tête de liste de votre branche.",
      isGlobal: true,
      authorId: created["+22890101011"].id,
    },
  });
  await db.announcement.create({
    data: {
      title: "Avancement du forage : 60 % atteint",
      content: "Le forage du puits de Kpimé a atteint 60 % d'avancement. L'entreprise prévoit la finalisation pour mi-octobre. Un rappel aux membres n'ayant pas encore versé leur apport : le projet a besoin de nous tous !",
      isGlobal: false,
      registryId: brancheSud.id,
      authorId: created["+22890303030"].id,
    },
  });
  await db.announcement.create({
    data: {
      title: "Merci pour la réussite de la collecte du mois d'août",
      content: "La famille remercie chaleureusement les 10 membres de la branche Nord qui ont réglé leur cotisation avant l'échéance du 5 août. Les retardataires sont priés de régulariser auprès du trésorier.",
      isGlobal: false,
      registryId: brancheNord.id,
      authorId: created["+22890101012"].id,
    },
  });

  await db.auditLog.create({
    data: {
      memberId: admin.id,
      action: "CREATE",
      entityType: "Registry",
      entityId: brancheNord.id,
      details: `Initialisation de la plateforme — registre « ${brancheNord.name} » créé`,
    },
  });

  console.log("\n✅ Données de démonstration prêtes !");
  console.log("─────────────────────────────────────────────");
  console.log("👑 Admin Général   : +22890101010 / Admin@2026");
  console.log("🗝️  Tête de liste   : +22890101011 / Tete@2026");
  console.log("💰 Trésorier       : +22890101012 / Tresor@2026");
  console.log("👤 Membre (1ère connexion) : +22890202020 / Famille2026!");
  console.log("─────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
