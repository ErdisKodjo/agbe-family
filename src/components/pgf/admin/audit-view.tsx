"use client";
// ============================================================
// PGF — Journal d'audit (traçabilité)
// ============================================================
import { useEffect, useState } from "react";
import { get } from "../api";
import type { AuditRow } from "../types";
import { PageHeader, EmptyState } from "../shared/ui-bits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, ShieldCheck, Download, UserPlus, Pencil, Trash2, CheckCircle2, XCircle, LogIn } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTION_LABELS } from "@/lib/constants";
import { downloadCSV } from "../api";

const ACTION_ICONS: Record<string, any> = {
  CREATE: UserPlus,
  UPDATE: Pencil,
  DELETE: Trash2,
  VALIDATE: CheckCircle2,
  REJECT: XCircle,
  LOGIN: LogIn,
  LOGOUT: LogIn,
};

const ACTION_TONES: Record<string, string> = {
  CREATE: "bg-primary/10 text-primary",
  UPDATE: "bg-amber-500/10 text-amber-600",
  DELETE: "bg-rose-500/10 text-rose-600",
  VALIDATE: "bg-emerald-500/10 text-emerald-600",
  REJECT: "bg-rose-500/10 text-rose-600",
  LOGIN: "bg-secondary text-secondary-foreground",
  LOGOUT: "bg-secondary text-secondary-foreground",
};

export function AuditView() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (action !== "all") params.set("action", action);
      if (entityType !== "all") params.set("entityType", entityType);
      const res = await get<{ logs: AuditRow[] }>(`/api/audit?${params}`);
      setLogs(res.logs);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [action, entityType]);

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["JOURNAL D'AUDIT — TRAÇABILITÉ", "", "", ""],
      ["Date", "Acteur", "Action", "Entité", "Détails"],
      ...logs.map((l) => [
        formatDateTime(l.createdAt),
        l.member ? `${l.member.firstName} ${l.member.lastName}` : "Système",
        AUDIT_ACTION_LABELS[l.action] ?? l.action,
        l.entityType,
        l.details ?? "",
      ]),
    ];
    downloadCSV(`journal-audit-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success("Journal exporté");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ScrollText}
        title="Journal d'audit"
        description="Traçabilité financière : qui a modifié quoi et quand."
        actions={
          <div className="flex gap-2">
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes actions</SelectItem>
                {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes entités</SelectItem>
                {["Member", "Registry", "Payment", "Transaction", "Project", "ProjectPhase", "ProjectTask", "ProjectContribution", "Campaign", "Announcement"].map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1.5" /> Exporter
            </Button>
          </div>
        }
      />

      <Card className="border-border/70">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-secondary animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Aucune entrée d'audit" description="Les actions des administrateurs apparaîtront ici." />
          ) : (
            <div className="max-h-[70vh] overflow-y-auto pgf-scroll divide-y divide-border/60">
              {logs.map((l) => {
                const Icon = ACTION_ICONS[l.action] ?? ScrollText;
                return (
                  <div key={l.id} className="flex items-center gap-4 px-4 sm:px-6 py-3 hover:bg-secondary/30">
                    <div className={`rounded-lg p-2 shrink-0 ${ACTION_TONES[l.action] ?? "bg-secondary"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{l.details || `${l.entityType} — ${l.action}`}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {l.member ? `${l.member.firstName} ${l.member.lastName}` : "Système"} · {formatDateTime(l.createdAt)}
                      </p>
                    </div>
                    <div className="hidden sm:block shrink-0">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {l.entityType}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
