# Amplify tenant routing test

Minimal Next.js 16 (App Router, Node runtime) app that checks wildcard-subdomain
multi-tenant routing on AWS Amplify Hosting (WEB_COMPUTE).

## How routing works

`proxy.ts` takes the host from `x-forwarded-host`, falling back to `host`. It
strips the port, lowercases the host, and resolves it with `lib/tenant.ts`:

| Host                                   | Site      | Rewritten to    |
| -------------------------------------- | --------- | --------------- |
| `<root>`, `www.<root>`                 | `public`  | `/s/public/*`   |
| `admin.<root>`                         | `admin`   | `/s/admin/*`    |
| `<slug>.<root>` (slug in `TENANTS`)    | `tenant`  | `/s/tenant/*`   |
| anything else, or a reserved slug      | `unknown` | 404             |
| a host in `DEV_HOSTS`                  | `tenant` = `DEV_TENANT_SLUG` (must also be in `TENANTS`) | |

`/debug` and `/api/*` aren't rewritten. They work on every host.

On every request, `proxy.ts` deletes any client-sent `x-tenant`, `x-site` or
`x-resolved-host` header and sets its own. Every response carries
`x-resolved-site` and `x-resolved-tenant`.

If `APP_ROOT_DOMAIN`, `APP_ENV` or `TENANTS` is missing, every route returns
HTTP 500 with a configuration-error page. `/api/*` returns a JSON error instead.

## Local

```bash
cp .env.example .env.local
npm install
npm run dev
# open http://localhost:3000, http://admin.localhost:3000, http://acme.localhost:3000
SCHEME=http PORT=3000 scripts/test-domains.sh localhost acme,globex
```

## Amplify

1. Set these environment variables in the Amplify console: `APP_ROOT_DOMAIN`,
   `APP_ENV`, `TENANTS`, and optionally `DEV_HOSTS`, `DEV_TENANT_SLUG` and
   `BUILD_ID`. If `BUILD_ID` isn't set, the build uses `AWS_COMMIT_ID`.
2. `amplify.yml` writes only those variables into `.env.production` before
   `next build`. The SSR runtime reads them from there.
3. Add the custom domain with both the apex and a `*` subdomain mapped to the branch.
4. Run `scripts/test-domains.sh <root-domain> acme,globex`.

## Things to check on Amplify

- **`X-Forwarded-Host` spoofing.** The last spoof check in the test script sends
  a forged `X-Forwarded-Host`. If it fails, the edge passes the client's header
  through to the app. That means anyone can pick a tenant by sending the
  header, so the real app must not trust it as-is.
- **Cookie isolation.** Click "Set test cookie" on `acme.<root>`, then open
  `globex.<root>`. The cookie should show as "not present". If globex receives
  another tenant's cookie, the page shows a LEAK warning.
- **Instance count.** Refresh `/debug` and watch `instance id` and `process
  uptime` to see how many compute instances serve requests and when they
  cold-start.
- **Deep links.** Hard-refresh `/employees/42` on a tenant host. It should
  return 200 and render on the server.
