// Facebook Login (OAuth 2.0 แบบ authorization code) — ใช้ทั้งฝั่งครู และฝั่งนักเรียนในระยะที่ 7

export type FacebookUser = { id: string; name?: string };

export function facebookConfigured(env: Env): boolean {
  return Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET);
}

/** URL หน้าขออนุญาตของ Facebook */
export function facebookAuthUrl(env: Env, redirectUri: string, state: string): string {
  const u = new URL(`${env.FACEBOOK_DIALOG_URL}/${env.FACEBOOK_GRAPH_VERSION}/dialog/oauth`);
  u.searchParams.set("client_id", env.FACEBOOK_APP_ID ?? "");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "public_profile");
  return u.toString();
}

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** แลก code เป็น access token แล้วดึง id/ชื่อ ของผู้ใช้ */
export async function facebookUserFromCode(env: Env, code: string, redirectUri: string): Promise<FacebookUser> {
  const base = `${env.FACEBOOK_GRAPH_URL}/${env.FACEBOOK_GRAPH_VERSION}`;
  const tokenUrl = new URL(`${base}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", env.FACEBOOK_APP_ID ?? "");
  tokenUrl.searchParams.set("client_secret", env.FACEBOOK_APP_SECRET ?? "");
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const tokenRes = await fetch(tokenUrl);
  const token = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  if (!tokenRes.ok || !token?.access_token) throw new Error(`facebook token exchange failed: ${tokenRes.status}`);

  const meUrl = new URL(`${base}/me`);
  meUrl.searchParams.set("fields", "id,name");
  meUrl.searchParams.set("access_token", token.access_token);
  meUrl.searchParams.set("appsecret_proof", await hmacSha256Hex(env.FACEBOOK_APP_SECRET ?? "", token.access_token));
  const meRes = await fetch(meUrl);
  const me = (await meRes.json().catch(() => null)) as FacebookUser | null;
  if (!meRes.ok || !me?.id) throw new Error(`facebook /me failed: ${meRes.status}`);
  return { id: String(me.id), name: me.name };
}
