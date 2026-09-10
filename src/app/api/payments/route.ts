// GET /api/payments — Paiements (filtrage selon rôle : confidentialité)
//   ?campaignId= &status= &mine=1 (espace membre) &registryId=
// POST /api/payments — Déclarer un paiement (membre ou trésorier) + preuve
//   body.direct = true (admin) → encaissement immédiat : paiement créé VALIDÉ
//   + recette portée au journal de caisse du registre en une seule transaction.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ROLES, INCOME_CATEGORIES } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const me = await requireAuth();
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");
    const status = searchParams.get("status");
    const mine = searchParams.get("mine");
    const registryId = searchParams.get("registryId");

    const where: any = {};
    if (campaignId) where.campaignId = campaignId;
    if (status) where.status = status;

    if (mine || !isAdmin(me)) {
      // Confidentialité : un membre ne voit que SES paiements,
      // sauf si le registre est en « Transparence Totale ».
      where.memberId = me.id;
      if (registryId && registryId !== "global") where.campaign = { registryId };
    } else {
      if (registryId && registryId !== "global") where.campaign = { registryId };
      else if (me.role === ROLES.HEAD || me.role === ROLES.TREASURER) {
        const registry = await db.registry.findFirst({ where: { headMemberId: me.id } });
        if (me.role === ROLES.HEAD && registry) where.campaign = { registryId: registry.id };
      }
    }

    const payments = await db.payment.findMany({
      where,
      include: {
        member: { select: { id: true, firstName: true, lastName: true, phone: true, registryId: true } },
        campaign: { select: { id: true, name: true, type: true } },
        validatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 300,
    });

    return NextResponse.json({ payments });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAuth();
    const body = await req.json();
    const amount = Number(body.amount);
    const campaignId = body.campaignId ? String(body.campaignId) : null;
    const memberId = isAdmin(me) && body.memberId ? String(body.memberId) : me.id;
    const direct = body.direct === true && isAdmin(me);

    if (!amount || amount <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });

    const campaign = campaignId
      ? await db.contributionCampaign.findUnique({ where: { id: campaignId } })
      : null;
    if (campaignId && !campaign) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

    const member = direct
      ? await db.member.findUnique({
          where: { id: memberId },
          select: { id: true, firstName: true, lastName: true, registryId: true },
        })
      : null;
    if (direct && !member) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

    // ---- Encaissement direct (admin) : VALIDÉ + trésorerie créditée atomiquement ----
    if (direct && member) {
      const payment = await db.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            campaignId,
            memberId,
            amount,
            method: String(body.method || "MOBILE_MONEY"),
            reference: body.reference ? String(body.reference) : null,
            proofUrl: body.proofUrl ? String(body.proofUrl) : null,
            note: body.note ? String(body.note) : null,
            status: "VALIDATED",
            paidAt: new Date(),
            validatedAt: new Date(),
            validatedById: me.id,
          },
        });
        const registryId = campaign?.registryId ?? member.registryId;
        if (registryId) {
          await tx.transaction.create({
            data: {
              registryId,
              type: "INCOME",
              date: new Date(),
              label: `Cotisation — ${member.firstName} ${member.lastName}${campaign ? ` (${campaign.name})` : ""}`,
              category: INCOME_CATEGORIES.COTISATION ? "COTISATION" : "AUTRE",
              amount,
              note: `Encaissement direct #${created.id} (saisi par ${me.firstName} ${me.lastName})`,
              recordedById: me.id,
            },
          });
        }
        return created;
      });

      await audit(
        me.id,
        "CREATE",
        "Payment",
        payment.id,
        `Encaissement direct de ${amount} FCFA — ${member.firstName} ${member.lastName}${campaign ? ` (« ${campaign.name} »)` : " (cotisation libre)"}`
      );
      return NextResponse.json({ payment });
    }

    const payment = await db.payment.create({
      data: {
        campaignId,
        memberId,
        amount,
        method: String(body.method || "MOBILE_MONEY"),
        reference: body.reference ? String(body.reference) : null,
        proofUrl: body.proofUrl ? String(body.proofUrl) : null,
        note: body.note ? String(body.note) : null,
        status: "PENDING",
      },
      include: {
        member: { select: { firstName: true, lastName: true } },
        campaign: { select: { name: true } },
      },
    });

    await audit(
      me.id,
      "CREATE",
      "Payment",
      payment.id,
      `Déclaration de paiement ${amount} FCFA${campaign ? ` — « ${campaign.name} »` : ""} par ${payment.member.firstName} ${payment.member.lastName}`
    );
    return NextResponse.json({ payment });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
