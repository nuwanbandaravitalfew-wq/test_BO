import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import type { Site } from "./tenant";

/** Site/tenant as resolved by proxy.ts (client-supplied values are stripped there). */
export async function getResolution(): Promise<{ site: Site; tenant: string; host: string }> {
  const h = await headers();
  return {
    site: (h.get("x-site") as Site | null) ?? "unknown",
    tenant: h.get("x-tenant") ?? "",
    host: h.get("x-resolved-host") ?? "",
  };
}

// Stored on globalThis so every route bundle in the same Node process shares one id.
const g = globalThis as typeof globalThis & { __instanceId?: string };
export function instanceId(): string {
  g.__instanceId ??= randomUUID().slice(0, 8);
  return g.__instanceId;
}
