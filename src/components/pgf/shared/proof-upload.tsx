"use client";
// ============================================================
// PGF — Téléversement de pièce justificative (preuve de paiement)
// ============================================================
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFile } from "../api";
import { Paperclip, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ProofUpload({
  value,
  onChange,
  label = "Pièce justificative (reçu, capture Mobile Money…)",
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState<string>("");

  const handleFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 8 Mo)");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
      setName(file.name);
      toast.success("Pièce jointe téléversée");
    } catch (e: any) {
      toast.error(e.message || "Échec du téléversement");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border bg-secondary/50 p-3">
          <div className="rounded-md bg-primary/10 text-primary p-2">
            {value.endsWith(".pdf") ? <FileText className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{name || "Pièce jointe"}</p>
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Voir la pièce
            </a>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Retirer la pièce">
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <>
          <Input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className={cn("cursor-pointer file:mr-3 file:cursor-pointer")}
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          {uploading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Téléversement en cours…
            </p>
          )}
        </>
      )}
    </div>
  );
}
