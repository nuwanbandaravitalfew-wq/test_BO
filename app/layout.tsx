import type { ReactNode } from "react";
import "./globals.css";

// Every response depends on the request host; never prerender or cache.
export const dynamic = "force-dynamic";

export const metadata = { title: "Tenant routing test" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
        <footer>
          build <code>{process.env.BUILD_ID || "(unset)"}</code> · <a href="/debug">/debug</a> ·{" "}
          <a href="/api/health">/api/health</a>
        </footer>
      </body>
    </html>
  );
}
