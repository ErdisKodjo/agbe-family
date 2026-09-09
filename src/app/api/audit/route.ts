// GET /api/audit — Journal d'audit (traçabilité, admins)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");
    const action = searchParams.get("action");
    const take = Math.min(500, Number(searchParams.get("take") || 200));

    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;

    const logs = await db.auditLog.findMany({
      where,
      include: { member: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return NextResponse.json({ logs });
  } catch (e: any) {
    if (e?.status) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
