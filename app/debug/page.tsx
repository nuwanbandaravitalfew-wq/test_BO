import { headers } from "next/headers";
import { getResolution, instanceId } from "@/lib/request";

const show = (v: string | null | undefined) => (v ? v : "(unset)");

export default async function DebugPage() {
  const h = await headers();
  const { site, tenant } = await getResolution();

  // Only non-secret values. Do not add arbitrary env vars here.
  const rows: [string, string][] = [
    ["resolved site", site],
    ["resolved tenant", show(tenant)],
    ["host", show(h.get("host"))],
    ["x-forwarded-host", show(h.get("x-forwarded-host"))],
    ["x-forwarded-proto", show(h.get("x-forwarded-proto"))],
    ["x-forwarded-for", show(h.get("x-forwarded-for"))],
    ["APP_ENV", show(process.env.APP_ENV)],
    ["APP_ROOT_DOMAIN", show(process.env.APP_ROOT_DOMAIN)],
    ["TENANTS", show(process.env.TENANTS)],
    ["DEV_HOSTS", show(process.env.DEV_HOSTS)],
    ["DEV_TENANT_SLUG", show(process.env.DEV_TENANT_SLUG)],
    ["TENANTS_TABLE", show(process.env.TENANTS_TABLE)],
    ["ADMIN_PASSWORD", process.env.ADMIN_PASSWORD ? "(set)" : "(unset)"],
    ["BUILD_ID", show(process.env.BUILD_ID)],
    ["server time", new Date().toISOString()],
    ["process uptime", `${process.uptime().toFixed(1)} s`],
    ["instance id", instanceId()],
    ["node version", process.version],
  ];

  return (
    <>
      <h1>Debug</h1>
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>
                <code>{v}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
