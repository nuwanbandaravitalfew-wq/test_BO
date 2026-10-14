import { NextResponse, type NextRequest } from "next/server";
import { hostFromHeaders, loadConfig, resolveHost } from "@/lib/tenant";

// Routes served identically on every host (not rewritten into a site tree).
const SHARED_PREFIXES = ["/debug", "/api/"];

export function proxy(request: NextRequest) {
  const host = hostFromHeaders(request.headers);
  const { pathname } = request.nextUrl;

  const cfg = loadConfig();
  if (!cfg.ok) {
    // Fail closed: no fallback values, every route returns 500.
    const res = pathname.startsWith("/api/")
      ? NextResponse.json({ status: "error", errors: cfg.errors }, { status: 500 })
      : new NextResponse(configErrorHtml(cfg.errors), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
    res.headers.set("x-resolved-site", "error");
    res.headers.set("x-resolved-tenant", "");
    res.headers.set("cache-control", "no-store");
    return res;
  }

  const { site, tenant } = resolveHost(host, cfg.config);

  // Never trust client-supplied routing headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant");
  requestHeaders.delete("x-site");
  requestHeaders.delete("x-resolved-host");
  requestHeaders.set("x-tenant", tenant);
  requestHeaders.set("x-site", site);
  requestHeaders.set("x-resolved-host", host);

  let res: NextResponse;
  if (SHARED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`))) {
    res = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = `/s/${site}${pathname === "/" ? "" : pathname}`;
    res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  res.headers.set("x-resolved-site", site);
  res.headers.set("x-resolved-tenant", tenant);
  return res;
}

export const config = {
  // Everything except build assets.
  matcher: ["/((?!_next/static|_next/image).*)"],
};

function configErrorHtml(errors: string[]): string {
  const items = errors.map((e) => `<li><code>${e}</code></li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Configuration error</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#7f1d1d}</style>
</head><body><h1>Configuration error</h1><p>The server is missing required configuration and will not serve requests:</p>
<ul>${items}</ul></body></html>`;
}
