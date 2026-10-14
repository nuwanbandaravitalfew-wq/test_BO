import { headers } from "next/headers";
import { adminLoginEnabled, isAdmin } from "@/lib/admin-auth";
import { getResolution } from "@/lib/request";
import { loadConfig } from "@/lib/tenant";
import { listDbTenants, storeEnabled, type DbTenant } from "@/lib/tenant-store";
import { createTenant, login, logout, removeTenant } from "./actions";

const ERRORS: Record<string, string> = {
  "bad-password": "Wrong password.",
  login: "Please log in.",
  "invalid-slug": "Slug must be 1–63 lowercase letters, digits or hyphens, not starting or ending with a hyphen.",
  reserved: "That slug is reserved.",
  exists: "A tenant with that slug already exists.",
  "not-found": "Tenant not found (static tenants from TENANTS can't be removed here).",
  "no-store": "TENANTS_TABLE is not configured, so tenants can't be added.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BackOfficeHome({ searchParams }: { searchParams: SearchParams }) {
  const { host } = await getResolution();
  const sp = await searchParams;
  const error = ERRORS[String(sp.error ?? "")];

  const header = (
    <>
      <h1>Back office</h1>
      <p>
        Host: <code>{host}</code> · APP_ENV: <code>{process.env.APP_ENV}</code>
      </p>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
    </>
  );

  if (!adminLoginEnabled()) {
    return (
      <>
        {header}
        <p>
          Admin login is disabled because <code>ADMIN_PASSWORD</code> is not set.
        </p>
      </>
    );
  }

  if (!(await isAdmin())) {
    return (
      <>
        {header}
        <form action={login}>
          <label>
            Password <input type="password" name="password" required autoFocus />
          </label>{" "}
          <button>Log in</button>
        </form>
      </>
    );
  }

  const cfg = loadConfig();
  const staticTenants = cfg.ok ? cfg.config.tenants : [];
  let dbTenants: DbTenant[] = [];
  let storeError = "";
  try {
    dbTenants = await listDbTenants();
  } catch (err) {
    storeError = err instanceof Error ? err.name : "read failed";
  }

  const urlFor = await tenantUrlBuilder(host);
  const created = typeof sp.created === "string" ? sp.created : "";
  const deleted = typeof sp.deleted === "string" ? sp.deleted : "";

  return (
    <>
      {header}
      <form action={logout}>
        <button>Log out</button>
      </form>

      {created && (
        <p style={{ color: "#15803d" }}>
          Created tenant <strong>{created}</strong>:{" "}
          <a href={urlFor(created)} target="_blank">
            {urlFor(created)}
          </a>
        </p>
      )}
      {deleted && <p>Deleted tenant {deleted}.</p>}

      <h2>Add tenant</h2>
      {storeEnabled() ? (
        <form action={createTenant}>
          <p>
            <label>
              Slug{" "}
              <input name="slug" required pattern="[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?" placeholder="initech" />
            </label>{" "}
            <code>.{cfg.ok ? cfg.config.rootDomain : ""}</code>
          </p>
          <p>
            <label>
              Display name <input name="name" maxLength={100} placeholder="Initech Pvt Ltd" />
            </label>
          </p>
          <button>Create tenant</button>
        </form>
      ) : (
        <p>
          <code>TENANTS_TABLE</code> is not set, so tenants can only come from the <code>TENANTS</code> env var.
        </p>
      )}

      <h2>Tenants</h2>
      {storeError && <p style={{ color: "#b91c1c" }}>Could not read the tenants table ({storeError}).</p>}
      <table>
        <thead>
          <tr>
            <th>Slug</th>
            <th>Name</th>
            <th>URL</th>
            <th>Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {staticTenants.map((slug) => (
            <tr key={`env-${slug}`}>
              <td>
                <code>{slug}</code>
              </td>
              <td></td>
              <td>
                <a href={urlFor(slug)}>{urlFor(slug)}</a>
              </td>
              <td>TENANTS env</td>
              <td></td>
            </tr>
          ))}
          {dbTenants.map((t) => (
            <tr key={`db-${t.slug}`}>
              <td>
                <code>{t.slug}</code>
              </td>
              <td>{t.name}</td>
              <td>
                <a href={urlFor(t.slug)}>{urlFor(t.slug)}</a>
              </td>
              <td>DynamoDB · {t.createdAt.slice(0, 10)}</td>
              <td>
                <form action={removeTenant}>
                  <input type="hidden" name="slug" value={t.slug} />
                  <button>Delete</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Builds tenant URLs from the current admin URL: admin.<root>[:port] -> <slug>.<root>[:port]. */
async function tenantUrlBuilder(adminHost: string): Promise<(slug: string) => string> {
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  const port = (h.get("host") ?? "").match(/:(\d+)$/)?.[1];
  const root = adminHost.replace(/^admin\./, "");
  return (slug) => `${proto}://${slug}.${root}${port ? `:${port}` : ""}`;
}
