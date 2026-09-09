// GET /api/auth/me — Membre connecté (null si déconnecté)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/auth";

export async function GET() {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ member: null });
  const registry = await db.registry.findUnique({ where: { id: member.registryId } });
  return NextResponse.json({
    member: {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      city: member.city,
      role: member.role,
      registryId: member.registryId,
      registryName: registry?.name ?? "",
      mustChangePassword: member.mustChangePassword,
    },
  });
}
