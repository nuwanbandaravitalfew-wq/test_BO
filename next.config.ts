import type { NextConfig } from "next";

// Server Actions reject requests whose Origin doesn't match the forwarded host.
// Allow the root domain and all its subdomains so the cookie test works behind
// Amplify/CloudFront. Read at build time from .env.production.
const rootDomain = (process.env.APP_ROOT_DOMAIN ?? "").trim().toLowerCase();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: rootDomain ? [rootDomain, `*.${rootDomain}`] : [],
    },
  },
};

export default nextConfig;
