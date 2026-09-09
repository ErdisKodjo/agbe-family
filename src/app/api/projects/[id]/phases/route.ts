// POST /api/projects/[id]/phases — Ajouter une phase (WBS)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Nom de la phase requis" }, { status: 400 });

    const count = await db.projectPhase.count({ where: { projectId: id } });
    const phase = await db.projectPhase.create({
      data: {
        projectId: id,
        name,
        position: count,
        budget: body.budget ? Number(body.budget) : null,
      },
    });
    await audit(admin.id, "CREATE", "ProjectPhase", phase.id, `Phase « ${name} » ajoutée au projet « ${project.name} »`);
    return NextResponse.json({ phase });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
