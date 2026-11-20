# App-style Student Home + Teacher Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้าแรกนักเรียนแบบแอป (การ์ดเรียนต่อ, ตัวเลข, แจ้งเตือน, คลิปใหม่), แถบเมนูล่าง 4 แท็บ, หน้าคำถามของฉัน/บัญชี, และหน้า "สรุป" ของครู

**Architecture:** Hono Worker + D1 เพิ่ม migration 0006 (ตาราง `watch_daily`, คอลัมน์ `questions.answer_seen_at`) และ API ใหม่ `/home`, `/my-questions`, `/admin/summary`, `/admin/badges`. React SPA เพิ่ม `StudentShell` (เนื้อหา + แถบเมนูล่าง) และแยกหน้าแรก/คลิปทั้งหมด. สไตล์ใหม่ต่อท้าย `src/theme/components.css` โดยยกจาก mockup `dash.css`.

**Tech Stack:** Cloudflare Workers, Hono 4, D1, React 19, Vite 8, TypeScript, Playwright (e2e ในโฟลเดอร์ scratchpad)

**Spec:** `docs/superpowers/specs/2026-11-20-student-dashboard-design.md`

## Global Constraints

- ห้ามเปลี่ยนธีม (สีกรม #123b6e / เหลือง #f7b81f / ส้ม #f26b1d, Kanit, หัวข้อสติกเกอร์) และ mockup รอบ 2 คือหน้าตาที่ตกลงแล้ว (`$S/dash-mock/*.html`, `dash.css`)
- `$S` = `/tmp/claude-0/-home-user-coursera-test/b1629fd8-ec07-57eb-abf5-b500a3dccf0b/scratchpad`
- เวลาเรียน = ผลรวม `watch_daily.seconds` ของ 7 วันล่าสุดตามวันเวลาไทย (รวมวันนี้); ลบแถวเก่ากว่า 8 วัน
- คำตอบ "ใหม่" = `answered_at > COALESCE(answer_seen_at, 0)`
- คลิป "ใหม่" ใช้กฎเดิมใน `/course` (ยังไม่เคยดู และเพิ่มมาไม่เกิน 7 วัน)
- ไฟล์สำรอง `BACKUP_VERSION = 5`, `RESTORABLE_VERSIONS = [2, 3, 4, 5]`, `watch_daily` ไม่สำรอง
- ทุก API นักเรียนใหม่ต้องผ่าน `requireApproved`; API ครูต้องผ่าน `requireAdmin`
- คิวรีต่อคำขอต้องเบา (แผนฟรี CPU 10ms): ใช้ `DB.batch` รวบคำสั่ง
- ห้ามรัน migration บนฐานข้อมูลจริง / merge จนกว่าครูอนุญาต

## Review Focus

1. คอร์สที่ยังไม่มีคลิปเลย → `/home` ไม่ล่ม, การ์ดเรียนต่อไม่แสดง, ตัวเลข 0/0 (ทดสอบใน Task 2)
2. นักเรียนรอยืนยัน/ถูกระงับ เปิด `/clips`, `/questions` ตรง ๆ → กลับไปหน้าสถานะเดิม ไม่เห็นแถบเมนู (Task 4)
3. ปุ่มย้อนกลับของเบราว์เซอร์จากหน้าดูคลิป → กลับแท็บเดิมที่มา (Task 4: ใช้ history ปกติ, ปุ่ม "← กลับ" ใช้ `history.back()` ถ้ามีหน้าก่อนหน้า มิฉะนั้นไป `/`)
4. `?t=` ที่ไม่ใช่ตัวเลข / ติดลบ / เกินความยาวคลิป → เล่นจากจุดเดิมตามปกติ ไม่ error (Task 5)
5. ครูตอบแล้วแก้คำตอบ → นักเรียนเห็นเป็น "ใหม่" อีกครั้ง (เพราะ `answered_at` ถูกอัปเดต) (Task 3)

---

### Task 1: Migration 0006 + เก็บเวลาดูรายวัน + สำรองข้อมูลเวอร์ชัน 5

**Files:**
- Create: `migrations/0006_dashboard.sql`
- Modify: `worker/routes/learn.ts` (`POST /videos/:id/progress`)
- Modify: `shared/maintenance.ts`, `worker/routes/maintenance.ts` (DELETE list ตอนกู้คืน)
- Modify: `$S/reset.sh` (เพิ่ม `DELETE FROM watch_daily`, preset `e2e13`)
- Test: `$S/e2e13.cjs`

**Interfaces:**
- Produces: ตาราง `watch_daily(student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE, day TEXT NOT NULL, seconds INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (student_id, day))`; คอลัมน์ `questions.answer_seen_at INTEGER`; SQL นิพจน์วันไทย `TH_DAY = "date('now', '+7 hours')"` export จาก `worker/lib/thaiDay.ts` พร้อม `TH_DAY_MINUS(n)` คืน `date('now', '+7 hours', '-n days')`

- [ ] **Step 1: เขียนเทส** ใน `e2e13.cjs` ส่วน "watch_daily":
  - บันทึกความคืบหน้า delta 30 สองครั้ง → `SELECT seconds FROM watch_daily` = 60 และ `day` = วันที่ไทยวันนี้
  - ใส่แถว day ย้อนหลัง 9 วันไว้ก่อน → หลังบันทึกความคืบหน้า แถวนั้นหายไป
  - ลบนักเรียน → แถว watch_daily ของคนนั้นหาย
  - สำรอง JSON ได้ `version === 5`, `tables.questions[0]` มีคีย์ `answer_seen_at`, ไม่มี `tables.watch_daily`; กู้ไฟล์ที่แก้ `version = 4` และลบ `answer_seen_at` ออก → 200 และ `answer_seen_at = answered_at`
- [ ] **Step 2: รัน** `bash $S/reset.sh e2e13 && LANG=C.UTF-8 node $S/e2e13.cjs $S` — Expected: FAIL (ไม่มีตาราง)
- [ ] **Step 3: เขียน migration** (`CREATE TABLE watch_daily …`, `ALTER TABLE questions ADD COLUMN answer_seen_at INTEGER`, `UPDATE questions SET answer_seen_at = answered_at` เพื่อไม่ให้คำตอบเดิมขึ้นเป็นใหม่) และใน progress batch เพิ่ม 2 คำสั่ง: upsert `watch_daily` (`seconds = seconds + excluded.seconds`) เมื่อ `add > 0`, และ `DELETE FROM watch_daily WHERE student_id = ?1 AND day < TH_DAY_MINUS(7)`
- [ ] **Step 4: สำรองข้อมูล** `BACKUP_TABLES.questions` เพิ่ม `"answer_seen_at"`, `BACKUP_COLUMN_DEFAULTS.answer_seen_at = "json_extract(value, '$.answered_at')"`, `BACKUP_VERSION = 5`, `RESTORABLE_VERSIONS = [2,3,4,5]`; รายการ DELETE ตอนกู้คืนเพิ่ม `"watch_daily"` ก่อน `"students"`
- [ ] **Step 5: รัน** `npx wrangler d1 migrations apply DB --local` แล้วเทส — Expected: PASS
- [ ] **Step 6: Commit** `feat: daily watch time and answer-seen tracking`

### Task 2: API `/home` สำหรับหน้าแรกนักเรียน

**Files:**
- Create: `shared/home.ts`
- Modify: `worker/routes/learn.ts` (เพิ่ม `learn.use("/home", requireApproved)`, `learn.get("/home")`)
- Test: `$S/e2e13.cjs` ส่วน "/home"

**Interfaces:**
- Consumes: `watch_daily`, `answer_seen_at`, `TH_DAY_MINUS` (Task 1); `percentOf`, `NEW_VIDEO_SEC` (learn.ts)
- Produces (`shared/home.ts`):
  ```ts
  export type HomeResume = { videoId: number; title: string; chapterNo: number; indexInChapter: number; chapterCount: number;
    lastPositionSec: number; percent: number; started: boolean };
  export type HomeVideo = { id: number; title: string; chapterNo: number; durationSec: number | null };
  export type HomeData = { resume: HomeResume | null; stats: { done: number; total: number; weekSeconds: number };
    alerts: { newAnswers: number; inProgress: number }; newVideos: HomeVideo[] };
  ```
  `chapterNo` = ลำดับบทในคอร์สเริ่มที่ 1 (ตาม `chapters.sort_order, id`), `indexInChapter` เริ่มที่ 1

- [ ] **Step 1: เขียนเทส** (เรียก API ผ่านหน้าเว็บที่ล็อกอินแล้ว):
  - นักเรียนยังไม่เคยดู → `resume.started === false`, `resume.videoId` = คลิปแรกของบทแรก, `stats.done === 0`
  - หลังดูคลิป 2 ค้าง 50% → `resume.videoId === 2`, `started === true`, `percent === 50`, `alerts.inProgress === 1`
  - ดูคลิป 1 จบ → `stats.done === 1`, `stats.total` = จำนวนคลิปในคอร์ส
  - `watch_daily` วันนี้ 600 + 6 วันก่อน 300 + 7 วันก่อน 999 → `weekSeconds === 900`
  - คำถามที่ตอบแล้วและยังไม่เห็น 1 ข้อ, ตอบแล้วเห็นแล้ว 1 ข้อ → `alerts.newAnswers === 1`
  - คลิปเพิ่มวันนี้ที่ยังไม่ดู → อยู่ใน `newVideos`; คลิปที่ `created_at` 8 วันก่อน → ไม่อยู่
  - คอร์สที่ไม่มีคลิป (นักเรียน ม.4 ใน preset ไม่มีบท) → `resume === null`, `stats.total === 0`, 200
  - นักเรียนรอยืนยัน → 403
- [ ] **Step 2: รันเทส** — Expected: FAIL 404
- [ ] **Step 3: เขียน `learn.get("/home")`** ด้วย `DB.batch` 4 คำสั่ง: (a) คลิปทั้งคอร์สเรียง `c.sort_order, c.id, v.sort_order, v.id` พร้อม progress และ `is_new`, (b) `SUM(seconds)` ของ `day >= TH_DAY_MINUS(6)`, (c) จำนวนคำตอบใหม่, (d) ลำดับบท; คำนวณ resume = คลิปที่ `last_watched_at` ล่าสุดและ % < 100 ถ้าไม่มีใช้คลิปแรกที่ยังไม่จบ (`started` = เคยมี progress); ถ้าทุกคลิปจบแล้ว resume = คลิปล่าสุดที่ดู
- [ ] **Step 4: รันเทส** — Expected: PASS
- [ ] **Step 5: Commit** `feat: /home summary API for students`

### Task 3: API คำถามของฉัน + ตั้งว่าเห็นคำตอบแล้ว

**Files:**
- Modify: `shared/questions.ts`, `worker/routes/learn.ts`
- Test: `$S/e2e13.cjs` ส่วน "my-questions"

**Interfaces:**
- Produces:
  ```ts
  export type MyQuestion = { id: number; videoId: number; videoTitle: string; positionSec: number | null; body: string;
    answer: string | null; answeredAt: number | null; createdAt: number; isNew: boolean; hidden: boolean };
  export type MyQuestions = { questions: MyQuestion[] };
  ```
  `GET /my-questions` (requireApproved) คืนคำถามของฉันทุกคลิป เรียง `COALESCE(answered_at, created_at) DESC`, แล้วตั้ง `answer_seen_at = unixepoch()` ให้ข้อที่ตอบแล้วใน batch เดียวกัน (แบบเดียวกับ `/announcements`)
  `GET /videos/:id/questions` (เดิม) ตั้ง `answer_seen_at` ให้คำถามของฉันในคลิปนั้นที่ตอบแล้วเช่นกัน

- [ ] **Step 1: เขียนเทส**: ครูตอบ 1 ข้อ → `/my-questions` ข้อนั้น `isNew === true`; เรียกซ้ำ → `false`; `/home` `newAnswers === 0`. ครูแก้คำตอบ → `isNew === true` อีกครั้ง (Review Focus 5). เปิด `/videos/1/questions` แทน → `/home` `newAnswers` ลดลง. ผลลัพธ์ไม่มีคำถามของคนอื่น
- [ ] **Step 2: รันเทส** — FAIL
- [ ] **Step 3: เขียน endpoint และเพิ่ม UPDATE ใน `/videos/:id/questions`** (ใช้ `db.batch` ให้ SELECT ก่อน UPDATE)
- [ ] **Step 4: รันเทส** — PASS
- [ ] **Step 5: Commit** `feat: my-questions API with unseen answers`

### Task 4: โครงหน้านักเรียน + แถบเมนูล่าง + หน้าแรก/คลิปทั้งหมด/บัญชี

**Files:**
- Create: `src/components/StudentShell.tsx`, `src/components/TabBar.tsx`, `src/pages/ClipsPage.tsx`, `src/pages/MyQuestionsPage.tsx`, `src/pages/ProfilePage.tsx`
- Modify: `src/App.tsx`, `src/pages/CoursePage.tsx` (กลายเป็นหน้าแรกแบบใหม่ — เปลี่ยนชื่อไฟล์เป็น `src/pages/StudentHomePage.tsx`), `src/pages/AccountPage.tsx` (ย้ายไป `/account/password`, ปุ่มกลับไป `/account`), `src/components/AnnouncementList.tsx` (prop `limit?: number` + ปุ่ม "ดูประกาศทั้งหมด"), `src/main.tsx` (footer เหนือแถบเมนู: คลาส `has-tabbar` เมื่อแสดงแถบ), `src/theme/components.css` (ยกคลาสจาก `$S/dash-mock/dash.css`: `ph-hero*`, `ph-stats`, `ph-stat*`, `ph-alerts`, `ph-alert-row*`, `ph-group-h`, `ph-vlist`, `ph-vrow*`, `ph-chap-done`, `ph-tabbar*`, `ph-acct*`, `has-tabbar`)
- Test: `$S/e2e13.cjs` ส่วน UI (iPhone 13)

**Interfaces:**
- Consumes: `HomeData` (Task 2), `MyQuestions` (Task 3), `CourseOutline` (`/course` เดิม)
- Produces: `TabBar({ active, newAnswers }: { active: "home" | "clips" | "questions" | "account"; newAnswers: number })`; `StudentShell({ active, children })` โหลด `newAnswers` จาก `/home` ครั้งเดียวต่อการเปลี่ยนหน้า; เส้นทางนักเรียนที่ยืนยันแล้ว `/`, `/clips`, `/questions`, `/account`, `/account/password`, `/watch/:id`; นักเรียนสถานะอื่นใช้ได้แค่ `/` และ `/account/password`
- `ClipsPage` อ่าน `?open=inprogress` จาก URL: กางทุกบทที่มีคลิปค้าง (กางบทเหล่านี้เสมออยู่แล้ว — query ใช้เลื่อนไปบทแรกที่มีคลิปค้าง)

- [ ] **Step 1: เขียนเทส UI**:
  - หน้าแรก: เห็น `.ph-hero` ข้อความ "เรียนต่อ" + ชื่อคลิป + "45%"; นักเรียนใหม่เห็น "เริ่มเรียน"; `.ph-stat` 2 ใบ ("ดูจบแล้ว" มี ›, "เวลาเรียน" ไม่มี ›); แถว "ครูตอบคำถามแล้ว" ซ่อนเมื่อ 0; ประกาศ 3 อัน → เห็น 2 + ปุ่ม "ดูประกาศทั้งหมด" กดแล้วเห็น 3; ไม่มีคลิปใหม่ → ไม่มีหัวข้อ "คลิปใหม่"
  - แถบเมนู: มี 4 ลิงก์, แท็บ active ถูกต้องทุกหน้า, จุดตัวเลขบน "คำถามของฉัน" = คำตอบใหม่ และหายหลังเปิดหน้า; หน้า `/watch/1` ไม่มี `.ph-tabbar`; ลิงก์ footer "สำหรับครู" ไม่ถูกแถบบัง (bottom ของลิงก์ < top ของแถบเมื่อเลื่อนสุด)
  - คลิปทั้งหมด: บทที่ดูจบครบเป็น `.ph-chap-done` กดแล้วกาง; สถานะขวา "จบแล้ว"/"45%"/"ใหม่"/"ยังไม่ได้ดู"; กดแถว "ดูค้างไว้" บนหน้าแรก → `/clips?open=inprogress`
  - บัญชี: แสดงชื่อ/โรงเรียน/คอร์ส/เบอร์, กด "เปลี่ยนรหัสผ่าน" → `/account/password` (ฟอร์มเดิมทำงาน), "ออกจากระบบ" → `/login`
  - นักเรียนรอยืนยันเปิด `/clips` ตรง → ถูกพาไป `/` เห็นหน้าสถานะ ไม่มีแถบเมนู (Review Focus 2)
  - ปุ่ม "← กลับ" ในหน้าดูคลิปที่เปิดจาก `/clips` → กลับ `/clips` (Review Focus 3)
- [ ] **Step 2: รันเทส** — FAIL
- [ ] **Step 3: เขียนหน้าและคอมโพเนนต์** ตาม mockup รอบ 2; ไอคอนแถบเมนูใช้ SVG เดียวกับ mockup
- [ ] **Step 4: รันเทส + `npx tsc -b`** — PASS
- [ ] **Step 5: ถ่ายภาพหน้าจอ** 4 หน้า (iPhone 13, deviceScaleFactor 2) เทียบกับ mockup
- [ ] **Step 6: Commit** `feat: app-style student home with bottom tabs`

### Task 5: เปิดคลิปตรงนาที (`?t=`)

**Files:**
- Modify: `src/App.tsx` (ส่ง `startAt` จาก query), `src/pages/WatchPage.tsx` (prop `jumpTo?: number`), `src/admin/QuestionsPage.tsx` ไม่แตะ
- Test: `$S/e2e13.cjs` ส่วน "?t="

**Interfaces:**
- Consumes: `MyQuestionsPage` ลิงก์ไป `/watch/${videoId}?t=${positionSec}` (Task 4)
- Produces: `WatchPage({ me, videoId, jumpTo, onAuthError })` — ถ้า `jumpTo` เป็นจำนวนเต็ม ≥ 0 และ < `durationSec` (หรือ duration ไม่รู้) ใช้แทน `startAt`

- [ ] **Step 1: เขียนเทส**: `/watch/1?t=154` → `.ph-player__time` ขึ้นต้น `2:34`; `?t=abc`, `?t=-5`, `?t=99999` → เล่นจากจุดค้างเดิม ไม่มี error (Review Focus 4); กดชื่อคลิปในหน้าคำถามของฉัน → URL `/watch/1?t=154`
- [ ] **Step 2: รันเทส** — FAIL
- [ ] **Step 3: แก้โค้ด** — `navigate()` ปัจจุบันเทียบแค่ pathname จึงใช้ได้กับ query
- [ ] **Step 4: รันเทส** — PASS
- [ ] **Step 5: Commit** `feat: open clip at a given minute`

### Task 6: หลังบ้าน — API สรุป + ตัวเลขบนเมนู

**Files:**
- Modify: `shared/admin.ts`, `worker/routes/admin.ts` (`/admin/summary`), `worker/routes/questions.ts` (แทน `/admin/questions/pending-count` ด้วย `/admin/badges` ใน admin.ts)
- Test: `$S/e2e14.cjs`

**Interfaces:**
- Produces:
  ```ts
  export type AdminSummary = {
    pendingQuestions: { count: number; latest: { studentName: string; videoTitle: string; positionSec: number | null; body: string; createdAt: number } | null };
    approved: { m12: number; m4: number };
    inactive: { count: number; never: number }; // ยืนยันแล้วและไม่ได้ดูเกิน 7 วัน (รวมคนไม่เคยดู) / ไม่เคยดูเลย
    pendingStudents: number;
    unfinishedVideos: number; // คลิปที่ไม่มีนักเรียนคนใดดูถึง 100% (ใช้ percentOf กฎเดิม: max_position_sec >= duration_sec - 10)
  };
  export type AdminBadges = { questions: number; students: number };
  ```
- [ ] **Step 1: เขียนเทส** ข้อมูลตั้งต้น preset `e2e14`: ม.1&2 ยืนยัน 2, ม.4 ยืนยัน 1, รอยืนยัน 2, คำถามรอตอบ 2 (ล่าสุดของ "สมใจ"), 3 คลิปมีคนดูจบ 1 คลิป → `approved {m12:2,m4:1}`, `pendingStudents 2`, `pendingQuestions.count 2` และ `latest.studentName` "สมใจ …", `unfinishedVideos 2`, `/admin/badges` = `{questions:2, students:2}`; ไม่มี cookie ครู → 401
- [ ] **Step 2: รันเทส** — FAIL
- [ ] **Step 3: เขียน endpoint** ด้วย `DB.batch`
- [ ] **Step 4: รันเทส** — PASS
- [ ] **Step 5: Commit** `feat: admin summary and menu badges API`

### Task 7: หลังบ้าน — หน้า "สรุป" + ย้ายหน้านักเรียน + เมนูแถวเดียว

**Files:**
- Create: `src/admin/SummaryPage.tsx`
- Modify: `src/admin/AdminApp.tsx` (PAGES: `/admin` สรุป, `/admin/students` นักเรียน, …; ตัวเลขทั้งสองเมนูจาก `/admin/badges`), `src/admin/StudentsPage.tsx` (อ่าน `?status=pending` เป็นตัวกรองเริ่มต้น), `src/admin/OverviewPage.tsx` (อ่าน `?filter=inactive`), `src/theme/components.css` (`.ph-adminnav` บนมือถือ `flex-wrap: nowrap; overflow-x: auto`)
- Test: `$S/e2e14.cjs` ส่วน UI

**Interfaces:**
- Consumes: `AdminSummary`, `AdminBadges` (Task 6)
- [ ] **Step 1: เขียนเทส**: เข้าหลังบ้าน → อยู่ `/admin` หัวข้อ "สรุป"; การ์ดใหญ่แสดงคำถามล่าสุด; ตอบคำถามหมด → การ์ดเป็น "นักเรียนรอยืนยัน 2 คน"; ยืนยันหมด → "ไม่มีงานค้าง 🎉"; การ์ดตัวเลข "ไม่เข้าเรียนเกิน 7 วัน" → `/admin/overview?filter=inactive` แท็บตัวกรองนั้น active; แถว "นักเรียนรอยืนยัน" → `/admin/students?status=pending`; แถวที่เป็น 0 ซ่อน; เมนู "นักเรียน" มีตัวเลข 2; หน้าประวัติรายคน `/admin/students/:id` ยังใช้ได้และเมนู "นักเรียน" active; มือถือ: `.ph-adminnav` สูงแถวเดียว
- [ ] **Step 2: รันเทส** — FAIL
- [ ] **Step 3: เขียนหน้า**
- [ ] **Step 4: รันเทส e2e14 + e2e12 (ชุดข้อ 10 เดิม, แก้ selector เมนูที่ย้าย) + `npx tsc -b` + `npx vite build`** — PASS ทั้งหมด
- [ ] **Step 5: ถ่ายภาพหน้าจอ** หน้าสรุป (iPhone 13 และ 1280px)
- [ ] **Step 6: Commit** `feat: teacher summary page as admin home`

### Task 8: อัปเดตเอกสาร + push

**Files:**
- Modify: `docs/PLAN.md` (หัวข้อหน้าเว็บนักเรียน/หลังบ้าน, migration 0006, หมายเหตุ production branch = main)
- [ ] **Step 1:** รันเทสทั้งหมด (e2e12, e2e13, e2e14) อีกรอบ — PASS
- [ ] **Step 2:** Commit `docs: update plan for dashboard` และ `git push -u origin claude/student-learning-platform-87z1jh`
- [ ] **Step 3:** ส่งภาพหน้าจอจริงให้ครู และขออนุญาต migrate 0006 + เปิด/merge PR
