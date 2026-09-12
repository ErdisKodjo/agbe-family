// GET /api/campaigns — Liste des campagnes (mensuelles + occasionnelles)
//   ?registryId= &type= &status=
//   Inclut l'avancement (collecté / attendu) et le détail par membre
// POST /api/campaigns — Créer une campagne
//   + occasionKey / beneficiaryMemberId (cotisation nommée)
//   + publishAnnouncement : publie une annonce au lancement
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, getCurrentMember } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { CAMPAIGN_TYPES } from "@/lib/constants";
import { OCCASION_KEYS, occasionLabel, normalizeCampaignName } from "@/components/pgf/shared/occasions";

// Format « 12 septembre 2026 » pour le contenu d'annonce (fr-FR, long)
const frLongDate = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const frMoney = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;

// Contenu de l'annonce générée au lancement d'une cotisation nommée
function buildAnnouncementContent(info: {
  description: string | null;
  targetAmount: number;
  amount: number;
  allowCustom: boolean;
  endDate: Date | null;
}): string {
  const lines: string[] = [];
  if (info.description) lines.push(info.description);
  lines.push("Une cotisation est lancée pour le registre. Détails :");
  if (info.targetAmount > 0) lines.push(`• Objectif : ${frMoney(info.targetAmount)}`);
  if (info.allowCustom) {
    lines.push("• Participation : montant personnalisé par membre (voir le suivi des cotisations)");
  } else if (info.amount > 0) {
    lines.push(`• Participation : ${frMoney(info.amount)} par membre`);
  } else {
    lines.push("• Participation : montant libre");
  }
  if (info.endDate) lines.push(`• Clôture des versements : ${frLongDate(info.endDate)}`);
  lines.push("Chaque membre peut déclarer son paiement depuis son espace (Mobile Money, espèce remise au trésorier…). Merci pour votre solidarité.");
  return lines.join("\n");
}


export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentMember();
    if (!me) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const registryId = searchParams.get("registryId");
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const where: any = {};
    if (registryId && registryId !== "global") where.registryId = registryId;
    if (type) where.type = type;
    if (status) where.status = status;

    const campaigns = await db.contributionCampaign.findMany({
      where,
      include: {
        registry: { select: { id: true, name: true } },
        beneficiary: { select: { id: true, firstName: true, lastName: true } },
        pledges: {
          include: {
            member: { select: { id: true, firstName: true, lastName: true, phone: true, city: true } },
          },
        },
        payments: {
          where: { status: "VALIDATED" },
          select: { memberId: true, amount: true },
        },
        _count: { select: { payments: { where: { status: "PENDING" } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const paidByMember = new Map<string, number>();
    const result = campaigns.map((c) => {
      paidByMember.clear();
      c.payments.forEach((p) => paidByMember.set(p.memberId, (paidByMember.get(p.memberId) ?? 0) + p.amount));
      const expected = c.pledges.reduce((s, p) => s + p.amountDue, 0);
      const collected = c.payments.reduce((s, p) => s + p.amount, 0);
      const contributorsCount = c.pledges.filter((p) => (paidByMember.get(p.memberId) ?? 0) > 0).length;
      const lateCount = c.pledges.filter((p) => (paidByMember.get(p.memberId) ?? 0) < p.amountDue).length;

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type,
        amount: c.amount,
        dueDay: c.dueDay,
        periodMonth: c.periodMonth,
        periodYear: c.periodYear,
        targetAmount: c.targetAmount,
        allowCustom: c.allowCustom,
        occasionKey: c.occasionKey,
        beneficiary: c.beneficiary,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        registry: c.registry,
        expected,
        collected,
        contributorsCount,
        lateCount,
        pendingPayments: c._count.payments,
        pledges: c.pledges.map((p) => ({
          memberId: p.memberId,
          member: p.member,
          amountDue: p.amountDue,
          amountPaid: paidByMember.get(p.memberId) ?? 0,
        })),
        createdAt: c.createdAt,
      };
    });

    return NextResponse.json({ campaigns: result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const name = String(body.name || "").trim();
    const type = String(body.type || CAMPAIGN_TYPES.MONTHLY);
    const registryId = String(body.registryId || "");

    if (!name) return NextResponse.json({ error: "Le nom de la campagne est requis" }, { status: 400 });
    const registry = await db.registry.findFirst({ where: { id: registryId, isGlobal: false } });
    if (!registry) return NextResponse.json({ error: "Registre valide requis" }, { status: 400 });

    // Cotisation nommée — type d'événement + bénéficiaire (membre concerné)
    const occasionKey = OCCASION_KEYS.includes(String(body.occasionKey || "")) ? String(body.occasionKey) : null;
    let beneficiaryMemberId: string | null = null;
    if (body.beneficiaryMemberId) {
      const beneficiary = await db.member.findFirst({
        where: { id: String(body.beneficiaryMemberId), isActive: true },
        select: { id: true },
      });
      if (!beneficiary) return NextResponse.json({ error: "Bénéficiaire (membre) introuvable" }, { status: 400 });
      beneficiaryMemberId = beneficiary.id;
    }

    // Garde-fou doublon : même intitulé normalisé sur une campagne ACTIVE du même registre
    if (type === CAMPAIGN_TYPES.OCCASIONAL) {
      const active = await db.contributionCampaign.findMany({
        where: { registryId: registry.id, status: "ACTIVE" },
        select: { name: true },
      });
      const dup = active.find((c) => normalizeCampaignName(c.name) === normalizeCampaignName(name));
      if (dup) {
        return NextResponse.json(
          { error: `Une campagne active porte déjà cet intitulé : « ${dup.name} ». Renommez ou clôturez-la avant.` },
          { status: 409 }
        );
      }
    }

    const data: any = {
      name,
      description: body.description ? String(body.description) : null,
      type,
      registryId: registry.id,
      status: "ACTIVE",
    };
    if (type === CAMPAIGN_TYPES.OCCASIONAL) {
      data.occasionKey = occasionKey;
      data.beneficiaryMemberId = beneficiaryMemberId;
    }

    if (type === CAMPAIGN_TYPES.MONTHLY) {
      data.amount = Number(body.amount) || 0;
      if (data.amount <= 0) return NextResponse.json({ error: "Montant mensuel invalide" }, { status: 400 });
      data.dueDay = Math.min(28, Math.max(1, Number(body.dueDay) || 5));
      data.periodMonth = body.periodMonth ? Number(body.periodMonth) : null;
      data.periodYear = body.periodYear ? Number(body.periodYear) : null;
    } else {
      data.targetAmount = Number(body.targetAmount) || 0;
      data.allowCustom = Boolean(body.allowCustom);
      data.amount = Number(body.amount) || 0;
      data.startDate = body.startDate ? new Date(body.startDate) : null;
      data.endDate = body.endDate ? new Date(body.endDate) : null;
    }

    // Créer la campagne + les engagements (pledges)
    // Option A (montant unique) : tous les membres actifs du registre
    // Option B (personnalisé) : liste de {memberId, amountDue} fournie
    let pledgeData: { memberId: string; amountDue: number }[] = [];
    if (type === CAMPAIGN_TYPES.OCCASIONAL && body.allowCustom && Array.isArray(body.pledges)) {
      pledgeData = body.pledges
        .map((p: any) => ({ memberId: String(p.memberId), amountDue: Number(p.amountDue) || 0 }))
        .filter((p: any) => p.memberId);
    } else {
      const members = await db.member.findMany({ where: { registryId: registry.id, isActive: true } });
      const amount = type === CAMPAIGN_TYPES.MONTHLY ? data.amount : data.amount;
      if (!(type === CAMPAIGN_TYPES.OCCASIONAL && !body.allowCustom && data.targetAmount > 0 && amount === 0)) {
        pledgeData = members.map((m) => ({ memberId: m.id, amountDue: amount }));
      }
    }

    // Annonce optionnelle au lancement (cotisation nommée) — même transaction
    const publishAnnouncement = type === CAMPAIGN_TYPES.OCCASIONAL && body.publishAnnouncement === true;
    const announcementData = publishAnnouncement
      ? {
          title: name,
          content: buildAnnouncementContent({
            description: data.description,
            targetAmount: data.targetAmount,
            amount: data.amount,
            allowCustom: data.allowCustom,
            endDate: data.endDate,
          }),
          isGlobal: false,
          registryId: registry.id,
          authorId: admin.id,
        }
      : null;

    const [campaign] = await db.$transaction([
      db.contributionCampaign.create({
        data: {
          ...data,
          pledges: { create: pledgeData },
        },
      }),
      ...(announcementData
        ? [db.announcement.create({ data: announcementData })]
        : []),
    ]);

    const details = [`Création de la campagne « ${name} » (${pledgeData.length} membres engagés)`];
    if (occasionLabel(occasionKey)) details.push(`Événement : ${occasionLabel(occasionKey)}`);
    if (beneficiaryMemberId) details.push("Bénéficiaire rattaché");
    if (announcementData) details.push("Annonce publiée");
    await audit(admin.id, "CREATE", "Campaign", campaign.id, details.join(" · "));
    return NextResponse.json({ campaign, announcementPublished: Boolean(announcementData) });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
