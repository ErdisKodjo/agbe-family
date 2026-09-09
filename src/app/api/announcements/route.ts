// GET /api/announcements — Fil d'annonces (globales + registre)
// POST /api/announcements — Publier une annonce (admin)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const me = await requireAuth();
    const announcements = await db.announcement.findMany({
      where: {
        OR: [{ isGlobal: true }, { registryId: me.registryId }],
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        registry: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ announcements });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth();
    if (!isAdmin(admin)) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
    const body = await req.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    if (!title || !content) return NextResponse.json({ error: "Titre et contenu requis" }, { status: 400 });

    const isGlobal = Boolean(body.isGlobal);
    const announcement = await db.announcement.create({
      data: {
        title,
        content,
        isGlobal,
        registryId: isGlobal ? null : admin.registryId,
        authorId: admin.id,
      },
      include: {
        author: { select: { firstName: true, lastName: true, role: true } },
        registry: { select: { name: true } },
      },
    });
    await audit(admin.id, "CREATE", "Announcement", announcement.id, `Annonce « ${title} »`);
    return NextResponse.json({ announcement });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
