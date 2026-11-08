import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { admin } from "./routes/admin";
import { auth } from "./routes/auth";
import { schools } from "./routes/schools";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

// กันเว็บอื่นส่งฟอร์มมาที่ API (ตรวจ Origin ของ request ที่เปลี่ยนข้อมูล)
app.use(csrf());

// ตรวจว่า Worker, D1 และ R2 พร้อมใช้งาน
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'",
  ).first<{ n: number }>();
  await c.env.FILES.head("__health__");
  return c.json({ ok: true, tables: row?.n ?? 0 });
});

app.route("/", auth);
app.route("/", admin);
app.route("/", schools);

app.notFound((c) => c.json({ error: "not_found" }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: "server_error", message: "ระบบขัดข้อง กรุณาลองใหม่" }, 500);
});

export default app;
