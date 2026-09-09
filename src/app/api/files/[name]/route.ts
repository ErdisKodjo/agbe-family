// GET /api/files/[name] — Diffusion sécurisée des pièces justificatives
import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    // Sécurité : nom de fichier simple uniquement (pas de traversée)
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      return NextResponse.json({ error: "Nom de fichier invalide" }, { status: 400 });
    }
    const filePath = path.join(UPLOAD_DIR, name);
    try {
      await stat(filePath);
    } catch {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }
    const data = await readFile(filePath);
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME[ext] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
