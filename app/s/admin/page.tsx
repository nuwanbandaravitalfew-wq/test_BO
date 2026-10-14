import { getResolution } from "@/lib/request";

export default async function BackOfficeHome() {
  const { host } = await getResolution();
  return (
    <>
      <h1>Back office</h1>
      <p>
        Host: <code>{host}</code>
      </p>
      <p>
        APP_ENV: <code>{process.env.APP_ENV}</code>
      </p>
    </>
  );
}
