// รหัสผ่าน: PBKDF2-SHA256 + salt ต่อคน
// ใช้ 20,000 รอบเพื่อให้อยู่ในลิมิต CPU 10ms ของ Workers แผนฟรี (100,000 รอบใช้ราว 17ms)
// จำนวนรอบถูกเก็บไว้ในค่าที่บันทึก จึงเพิ่มรอบภายหลังได้โดยรหัสเดิมยังใช้ได้

const ITERATIONS = 20_000;
const enc = new TextEncoder();

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iter, salt, hash] = stored.split("$");
  const iterations = Number(iter);
  if (algo !== "pbkdf2" || !Number.isInteger(iterations) || iterations <= 0 || !salt || !hash) return false;
  const expected = fromB64(hash);
  const actual = await derive(password, fromB64(salt), iterations);
  return actual.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(actual, expected);
}

/** ใช้ตรวจเมื่อไม่พบผู้ใช้ เพื่อให้เวลาตอบกลับใกล้เคียงกรณีรหัสผิด (เดาไม่ได้ว่าเบอร์ไหนสมัครแล้ว) */
export const DUMMY_HASH = "pbkdf2$20000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
