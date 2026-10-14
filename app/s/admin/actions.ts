"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  checkAdminPassword,
  isAdmin,
  newAdminSession,
} from "@/lib/admin-auth";
import { getResolution } from "@/lib/request";
import { isLocalHost, isValidTenantSlug, loadConfig, RESERVED_SLUGS } from "@/lib/tenant";
import { addDbTenant, deleteDbTenant, listDbTenants, storeEnabled } from "@/lib/tenant-store";

async function requireAdminHost(): Promise<string> {
  const { site, host } = await getResolution();
  if (site !== "admin") throw new Error("Not the admin host");
  return host;
}

async function requireAdmin(): Promise<void> {
  await requireAdminHost();
  if (!(await isAdmin())) redirect("/?error=login");
}

export async function login(formData: FormData) {
  const host = await requireAdminHost();
  if (!checkAdminPassword(String(formData.get("password") ?? ""))) redirect("/?error=bad-password");

  // Host-only cookie: never sent to tenant subdomains.
  (await cookies()).set(ADMIN_COOKIE, newAdminSession(), {
    httpOnly: true,
    secure: !isLocalHost(host),
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  redirect("/");
}

export async function logout() {
  await requireAdminHost();
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/");
}

export async function createTenant(formData: FormData) {
  await requireAdmin();
  if (!storeEnabled()) redirect("/?error=no-store");

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);

  if (RESERVED_SLUGS.has(slug)) redirect("/?error=reserved");
  if (!isValidTenantSlug(slug)) redirect("/?error=invalid-slug");

  const cfg = loadConfig();
  if (cfg.ok && cfg.config.tenants.includes(slug)) redirect("/?error=exists");
  if (!(await addDbTenant(slug, name || slug))) redirect("/?error=exists");

  redirect(`/?created=${slug}`);
}

export async function removeTenant(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  // Only back-office tenants can be removed; TENANTS env tenants are fixed.
  if (!(await listDbTenants()).some((t) => t.slug === slug)) redirect("/?error=not-found");
  await deleteDbTenant(slug);
  redirect(`/?deleted=${slug}`);
}
