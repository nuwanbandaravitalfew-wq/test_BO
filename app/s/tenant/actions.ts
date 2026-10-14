"use server";

import { cookies } from "next/headers";
import { getResolution } from "@/lib/request";
import { isLocalHost } from "@/lib/tenant";

const COOKIE = "test_session";

export async function setTestCookie() {
  const { site, tenant, host } = await getResolution();
  if (site !== "tenant" || !tenant) throw new Error("Not a tenant host");

  // No `domain` attribute: host-only cookie, must not leak to sibling subdomains.
  (await cookies()).set(COOKIE, `${tenant}-${Date.now()}`, {
    httpOnly: true,
    secure: !isLocalHost(host),
    sameSite: "lax",
    path: "/",
  });
}

export async function clearTestCookie() {
  (await cookies()).delete(COOKIE);
}
