import { getResolution } from "@/lib/request";

export default async function NotFound() {
  const { site, host } = await getResolution();
  return (
    <>
      <h1>{site === "unknown" ? "Tenant not found" : "Page not found"}</h1>
      <p>
        Host received: <code>{host || "(none)"}</code>
      </p>
      <p>
        Resolved site: <code>{site}</code>
      </p>
    </>
  );
}
