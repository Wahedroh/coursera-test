import { Hono } from "hono";

export const schools = new Hono<{ Bindings: Env }>();

// รายชื่อโรงเรียนที่เคยมีคนกรอก ใช้เด้งให้เลือกในฟอร์มสมัคร
schools.get("/schools", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 50);
  if (!q) return c.json({ schools: [] });
  const pattern = `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
  const { results } = await c.env.DB.prepare(
    "SELECT name FROM schools WHERE name LIKE ?1 ESCAPE '\\' ORDER BY name LIMIT 10",
  )
    .bind(pattern)
    .all<{ name: string }>();
  return c.json({ schools: results.map((r) => r.name) });
});
