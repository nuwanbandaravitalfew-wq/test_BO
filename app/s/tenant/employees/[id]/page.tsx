import { notFound } from "next/navigation";
import { getResolution } from "@/lib/request";

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site, tenant, host } = await getResolution();
  if (site !== "tenant") notFound();

  return (
    <>
      <h1>Employee {id}</h1>
      <table>
        <tbody>
          <tr>
            <th>Employee id</th>
            <td>
              <code>{id}</code>
            </td>
          </tr>
          <tr>
            <th>Tenant</th>
            <td>
              <code>{tenant}</code>
            </td>
          </tr>
          <tr>
            <th>Host</th>
            <td>
              <code>{host}</code>
            </td>
          </tr>
          <tr>
            <th>Rendered at</th>
            <td>
              <code>{new Date().toISOString()}</code>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <a href="/">← tenant home</a>
      </p>
    </>
  );
}
