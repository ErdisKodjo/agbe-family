// ============================================================
// PGF — Client API (fetch typé + helpers d'export)
// ============================================================

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `Erreur ${res.status}`, res.status);
  }
  return data as T;
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body: any) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T = any>(path: string, body: any) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const put = <T = any>(path: string, body: any) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const del = <T = any>(path: string) => api<T>(path, { method: "DELETE" });

export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await api<{ url: string }>("/api/upload", { method: "POST", body: fd });
  return res.url;
}

// ------------------------------------------------------------
// Exports de fichiers (CSV/Excel, Word, PDF impression)
// ------------------------------------------------------------

/** CSV avec BOM UTF-8 + séparateur « ; » (compatible Excel FR) */
export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(";")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Document Word (HTML encapsulé, ouvrable dans Word/LibreOffice) */
export function downloadWord(filename: string, title: string, htmlBody: string) {
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: "Segoe UI", Calibri, sans-serif; color: #1a2e22; margin: 2cm; }
  h1 { color: #0b6b4f; font-size: 22pt; border-bottom: 2px solid #0b6b4f; padding-bottom: 8px; }
  h2 { color: #0b6b4f; font-size: 14pt; margin-top: 18px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th { background: #0b6b4f; color: white; padding: 8px; text-align: left; font-size: 10pt; }
  td { border: 1px solid #ccd9d2; padding: 6px 8px; font-size: 10pt; }
  .total td { font-weight: bold; background: #eef5f1; }
  .muted { color: #6b7c73; font-size: 9pt; }
</style>
</head>
<body>${htmlBody}</body>
</html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
