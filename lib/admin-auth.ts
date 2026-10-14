// Password login for the back office. The session cookie is an HMAC of its
// expiry keyed with ADMIN_PASSWORD, so changing the password logs everyone out.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

function password(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

export function adminLoginEnabled(): boolean {
  return password().length > 0;
}

function sign(exp: string): string {
  return createHmac("sha256", password()).update(`admin-session:${exp}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkAdminPassword(input: string): boolean {
  return adminLoginEnabled() && safeEqual(input, password());
}

export function newAdminSession(): string {
  const exp = String(Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS);
  return `${exp}.${sign(exp)}`;
}

export async function isAdmin(): Promise<boolean> {
  if (!adminLoginEnabled()) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}
