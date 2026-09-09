// PATCH /api/tasks/[id] — Statut / assignation d'une tâche
// DELETE /api/tasks/[id] — Supprimer une tâche
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const existing = await db.projectTask.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });

    // Un membre assigné peut mettre à jour le statut de SA tâche ;
    // les admins peuvent tout modifier.
    const isAssignee = existing.assigneeId === me.id;
    if (!isAdmin(me) && !isAssignee) {
      return NextResponse.json({ error: "Vous ne pouvez modifier que vos tâches" }, { status: 403 });
    }

    const data: any = {};
    if (body.status != null) data.status = String(body.status);
    if (isAdmin(me)) {
      if (body.title != null) data.title = String(body.title).trim();
      if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
      if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId ? String(body.assigneeId) : null;
      if (body.phaseId !== undefined) data.phaseId = body.phaseId ? String(body.phaseId) : null;
      if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    const task = await db.projectTask.update({ where: { id }, data });
    await audit(me.id, "UPDATE", "ProjectTask", id, `Tâche « ${task.title} » → ${task.status}`);
    return NextResponse.json({ task });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const existing = await db.projectTask.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });
    await db.projectTask.delete({ where: { id } });
    await audit(admin.id, "DELETE", "ProjectTask", id, `Suppression de la tâche « ${existing.title} »`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
