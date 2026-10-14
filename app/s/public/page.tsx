import { getResolution } from "@/lib/request";

export default async function PublicHome() {
  const { host } = await getResolution();
  return (
    <>
      <h1>Public site</h1>
      <p>
        Host: <code>{host}</code>
      </p>
      <p>
        APP_ENV: <code>{process.env.APP_ENV}</code>
      </p>
    </>
  );
}
