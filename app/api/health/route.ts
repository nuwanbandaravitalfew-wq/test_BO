import { NextResponse } from "next/server";
import { getResolution } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET() {
  const { site, tenant, host } = await getResolution();
  return NextResponse.json(
    {
      status: "ok",
      site,
      tenant,
      host,
      appEnv: process.env.APP_ENV ?? "",
      buildId: process.env.BUILD_ID ?? "",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
