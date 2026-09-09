// GET /api/projects/[id] — Détail projet
// PATCH /api/projects/[id] — Modifier la fiche projet
// DELETE /api/projects/[id] — Supprimer le projet
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

async function projectWithRelations(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      registry: { select: { id: true, name: true } },
      phases: { orderBy: { position: "asc" } },
      tasks: { include: { assignee: { select: { id: true, firstName: true, lastName: true } }, phase: { select: { name: true } } } },
      contributions: { include: { member: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { date: "desc" } },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth();
    const { id } = await params;
    const project = await projectWithRelations(id);
    if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth();
    if (!isAdmin(me)) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
    const { id } = await params;
    const body = await req.json();
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

    const data: any = {};
    if (body.name != null) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
    if (body.startDate != null) data.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.budget != null) data.budget = Number(body.budget);
    if (body.status != null) data.status = String(body.status);

    const project = await db.project.update({ where: { id }, data });
    await audit(me.id, "UPDATE", "Project", id, `Modification du projet « ${project.name} »`);
    return NextResponse.json({ project: await projectWithRelations(id) });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth();
    if (!isAdmin(me)) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
    const { id } = await params;
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
    await db.project.delete({ where: { id } });
    await audit(me.id, "DELETE", "Project", id, `Suppression du projet « ${existing.name} »`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
