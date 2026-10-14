import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getResolution } from "@/lib/request";
import { clearTestCookie, setTestCookie } from "./actions";

export default async function TenantHome() {
  const { site, tenant, host } = await getResolution();
  if (site !== "tenant") notFound();

  const cookie = (await cookies()).get("test_session");

  return (
    <>
      <h1 className="big">{tenant}</h1>
      <p>
        Host: <code>{host}</code> · APP_ENV: <code>{process.env.APP_ENV}</code>
      </p>

      <h2>Deep links</h2>
      <ul>
        <li>
          <a href="/employees/42">/employees/42</a>
        </li>
        <li>
          <a href="/employees/abc-123">/employees/abc-123</a>
        </li>
      </ul>

      <h2>Cookie isolation</h2>
      <p>
        <code>test_session</code>:{" "}
        {cookie ? <strong><code>{cookie.value}</code></strong> : <em>not present</em>}
      </p>
      {cookie && !cookie.value.startsWith(`${tenant}-`) && (
        <p style={{ color: "#b91c1c" }}>
          <strong>LEAK:</strong> this cookie was set by a different tenant.
        </p>
      )}
      <form>
        <button formAction={setTestCookie}>Set test cookie</button>
        <button formAction={clearTestCookie}>Clear</button>
      </form>
    </>
  );
}
