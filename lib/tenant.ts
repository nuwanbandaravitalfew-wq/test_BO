// Host -> site/tenant resolution. Pure functions, shared by proxy.ts and pages.

export type Site = "public" | "admin" | "tenant" | "unknown";

export interface Resolution {
  site: Site;
  tenant: string; // "" unless site === "tenant"
}

export interface AppConfig {
  rootDomain: string;
  appEnv: string;
  tenants: string[];
  devHosts: string[];
  devTenantSlug: string;
  buildId: string;
}

export type ConfigResult =
  | { ok: true; config: AppConfig }
  | { ok: false; errors: string[] };

export const RESERVED_SLUGS = new Set([
  "admin",
  "www",
  "api",
  "app",
  "mail",
  "support",
  "staging",
  "dev",
]);

// Single DNS label: lowercase alphanumerics and hyphens, no leading/trailing hyphen.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isValidTenantSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug);
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Reads and validates env vars. Fails closed: no defaults for required values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ConfigResult {
  const errors: string[] = [];

  const rootDomain = (env.APP_ROOT_DOMAIN ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  const appEnv = (env.APP_ENV ?? "").trim();
  const tenants = list(env.TENANTS).filter(isValidTenantSlug);

  if (!rootDomain) errors.push("APP_ROOT_DOMAIN is not set");
  if (!appEnv) errors.push("APP_ENV is not set");
  if (!env.TENANTS?.trim()) errors.push("TENANTS is not set");
  else if (tenants.length === 0) errors.push("TENANTS contains no valid, non-reserved slugs");

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    config: {
      rootDomain,
      appEnv,
      tenants,
      devHosts: list(env.DEV_HOSTS).map(normalizeHost),
      devTenantSlug: (env.DEV_TENANT_SLUG ?? "").trim().toLowerCase(),
      buildId: (env.BUILD_ID ?? "").trim(),
    },
  };
}

/** Lowercases, takes the first value of a comma list, strips port and trailing dot. */
export function normalizeHost(raw: string | null | undefined): string {
  let host = (raw ?? "").split(",")[0].trim().toLowerCase();
  if (host.startsWith("[")) {
    // IPv6 literal, e.g. [::1]:3000
    const end = host.indexOf("]");
    host = end === -1 ? host : host.slice(0, end + 1);
  } else {
    host = host.replace(/:\d+$/, "");
  }
  return host.replace(/\.$/, "");
}

/** Picks x-forwarded-host if present, else host. */
export function hostFromHeaders(headers: Headers): string {
  return normalizeHost(headers.get("x-forwarded-host") || headers.get("host"));
}

export function resolveHost(host: string, config: AppConfig): Resolution {
  const { rootDomain, tenants, devHosts, devTenantSlug } = config;

  if (host && devHosts.includes(host)) {
    // DEV_TENANT_SLUG must still be a known, non-reserved tenant.
    if (isValidTenantSlug(devTenantSlug) && tenants.includes(devTenantSlug)) {
      return { site: "tenant", tenant: devTenantSlug };
    }
    return { site: "unknown", tenant: "" };
  }

  if (host === rootDomain || host === `www.${rootDomain}`) {
    return { site: "public", tenant: "" };
  }
  if (host === `admin.${rootDomain}`) {
    return { site: "admin", tenant: "" };
  }

  const suffix = `.${rootDomain}`;
  if (host.endsWith(suffix)) {
    const slug = host.slice(0, -suffix.length);
    // slug must be exactly one label (no "a.b.<root>") and a known tenant.
    if (isValidTenantSlug(slug) && tenants.includes(slug)) {
      return { site: "tenant", tenant: slug };
    }
  }

  return { site: "unknown", tenant: "" };
}

export function isLocalHost(host: string): boolean {
  return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "[::1]";
}
