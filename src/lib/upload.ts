import { ApiError } from "./api";

/** อัปโหลดไฟล์แบบ multipart/form-data (ใช้กับเอกสาร PDF) */
export async function uploadForm<T>(path: string, fields: Record<string, string | Blob>): Promise<T> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await fetch(`/api${path}`, { method: "POST", body: fd, credentials: "same-origin" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
