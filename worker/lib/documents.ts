import type { DocKind, DocumentInfo } from "../../shared/content";

// เอกสาร PDF เก็บใน R2 (binding FILES) ข้อมูลไฟล์เก็บในตาราง documents

export type DocRow = { id: number; video_id: number; kind: DocKind; filename: string; size_bytes: number };

export const toDocInfo = (d: DocRow): DocumentInfo => ({
  id: d.id,
  kind: d.kind,
  filename: d.filename,
  sizeBytes: d.size_bytes,
});

export const DOC_COLUMNS = "d.id, d.video_id, d.kind, d.filename, d.size_bytes";

/** ไฟล์เป็น PDF จริงหรือไม่ (ดูจาก 5 ไบต์แรก "%PDF-") */
export async function isPdf(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === "%PDF-";
}

/** ชื่อไฟล์สำหรับแสดงและดาวน์โหลด: ตัดโฟลเดอร์และอักขระควบคุม ลงท้าย .pdf */
export function cleanFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  let n = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 150);
  if (!n) n = "document";
  return /\.pdf$/i.test(n) ? n : `${n}.pdf`;
}

/** ลบไฟล์ใน R2 (ใช้หลังลบแถวในฐานข้อมูล) */
export async function deleteObjects(bucket: R2Bucket, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
}

/** ส่งไฟล์ PDF จาก R2 ให้ดาวน์โหลด */
export async function serveDocument(bucket: R2Bucket, key: string, filename: string): Promise<Response> {
  const obj = await bucket.get(key);
  if (!obj) return Response.json({ error: "not_found" }, { status: 404 });
  return new Response(obj.body, {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(obj.size),
      "content-disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
