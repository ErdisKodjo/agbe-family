// POST /api/projects/[id]/tasks — Assigner une tâche (« qui fait quoi »)
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

    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ error: "Intitulé de la tâche requis" }, { status: 400 });
    const assigneeId = body.assigneeId ? String(body.assigneeId) : null;
    if (assigneeId) {
      const m = await db.member.findUnique({ where: { id: assigneeId } });
      if (!m) return NextResponse.json({ error: "Membre assigné introuvable" }, { status: 404 });
    }

    const task = await db.projectTask.create({
      data: {
        projectId: id,
        title,
        description: body.description ? String(body.description) : null,
        assigneeId,
        phaseId: body.phaseId ? String(body.phaseId) : null,
        status: String(body.status || "TODO"),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
      include: { assignee: { select: { firstName: true, lastName: true } } },
    });

    await audit(
      admin.id,
      "CREATE",
      "ProjectTask",
      task.id,
      `Tâche « ${title} » assignée${task.assignee ? ` à ${task.assignee.firstName} ${task.assignee.lastName}` : ""} — projet « ${project.name} »`
    );
    return NextResponse.json({ task });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
