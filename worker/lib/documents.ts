import type { DocKind, DocumentInfo } from "../../shared/content";

// เอกสารเป็นลิงก์ OneDrive ที่ครูวางไว้ (ไม่ได้เก็บไฟล์ในระบบ)

export type DocRow = { id: number; video_id: number; kind: DocKind; title: string; url: string };

export const toDocInfo = (d: DocRow): DocumentInfo => ({ id: d.id, kind: d.kind, title: d.title, url: d.url });

export const DOC_COLUMNS = "d.id, d.video_id, d.kind, d.title, d.url";

export const DOC_ORDER = "CASE d.kind WHEN 'handout' THEN 0 ELSE 1 END, d.id";
