export class ApiError extends Error {
  status: number;
  body: { error?: string; message?: string; fields?: Record<string, string> } | null;
  constructor(status: number, body: ApiError["body"]) {
    super(body?.message ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** เรียก API ของเว็บ (ส่ง JSON, cookie same-origin) */
export async function api<T>(path: string, body?: unknown, opts?: { keepalive?: boolean }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    // keepalive: ส่งได้แม้กำลังปิดหน้า (ใช้ตอนบันทึกความคืบหน้า)
    keepalive: opts?.keepalive,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
