// POST /api/upload — Téléversement de pièces justificatives
// (preuve de paiement, facture, reçu) — images + PDF
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_SIZE = 8 * 1024 * 1024; // 8 Mo
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "Fichier trop volumineux (max 8 Mo)" }, { status: 400 });

    const ext = ALLOWED[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Format non supporté (JPG, PNG, WEBP, GIF ou PDF)" }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, name), buffer);

    return NextResponse.json({ url: `/api/files/${name}`, size: file.size, type: file.type });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
