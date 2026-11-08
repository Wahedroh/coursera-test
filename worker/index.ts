import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

// ตรวจว่า Worker, D1 และ R2 พร้อมใช้งาน
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'",
  ).first<{ n: number }>();
  await c.env.FILES.head("__health__");
  return c.json({ ok: true, tables: row?.n ?? 0 });
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
