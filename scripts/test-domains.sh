#!/usr/bin/env bash
# Verifies wildcard-subdomain tenant routing with curl.
#
# Usage: scripts/test-domains.sh <root-domain> [tenant1,tenant2]
#   scripts/test-domains.sh hr101test.com acme,globex
#   SCHEME=http PORT=3000 scripts/test-domains.sh localhost acme,globex   # local dev
#
# Exit code is non-zero if any check doesn't match the expected routing.
set -u

if [ $# -lt 1 ]; then
  echo "usage: $0 <root-domain> [tenant1,tenant2]" >&2
  exit 2
fi

ROOT="$1"
TENANTS="${2:-acme,globex}"
SCHEME="${SCHEME:-https}"
PORT_SUFFIX="${PORT:+:$PORT}"
UNKNOWN="zz-unknown-$RANDOM$RANDOM"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

failures=0

# fetch <host> <path> [extra curl args...]  -> sets STATUS SITE TENANT BODY
fetch() {
  local host="$1" path="$2"
  shift 2
  STATUS="$(curl -sS --max-time 20 -D "$tmp/h" -o "$tmp/b" -w '%{http_code}' "$@" \
    "$SCHEME://$host$PORT_SUFFIX$path" 2>"$tmp/e")" || STATUS="ERR($(tr -d '\n' < "$tmp/e"))"
  SITE="$(tr -d '\r' < "$tmp/h" 2>/dev/null | awk -F': ' 'tolower($1)=="x-resolved-site"{print $2}' | tail -1)"
  TENANT="$(tr -d '\r' < "$tmp/h" 2>/dev/null | awk -F': ' 'tolower($1)=="x-resolved-tenant"{print $2}' | tail -1)"
  BODY="$(head -c 300 "$tmp/b" 2>/dev/null | tr -d '\n')"
}

# check <host> <path> <expected-status> <expected-site> <expected-tenant> [extra curl args...]
check() {
  local host="$1" path="$2" want_status="$3" want_site="$4" want_tenant="$5"
  shift 5
  fetch "$host" "$path" "$@"
  local result="PASS"
  if [ "$STATUS" != "$want_status" ] || [ "$SITE" != "$want_site" ] || [ "$TENANT" != "$want_tenant" ]; then
    result="FAIL"
    failures=$((failures + 1))
  fi
  printf '%-4s %-38s %-18s %-6s %-8s %-10s (want %s %s %s)\n' \
    "$result" "$host" "$path" "$STATUS" "${SITE:--}" "${TENANT:--}" "$want_status" "$want_site" "${want_tenant:--}"
  case "$path" in
    /api/health) printf '     body: %s\n' "$BODY" ;;
  esac
}

# Each host: <host>|<expected-site>|<expected-tenant>|<expected-status-for-/>
cases="$ROOT|public||200
www.$ROOT|public||200
admin.$ROOT|admin||200"
IFS=',' read -r -a tenant_list <<< "$TENANTS"
for t in "${tenant_list[@]}"; do
  cases="$cases
$t.$ROOT|tenant|$t|200"
done
cases="$cases
$UNKNOWN.$ROOT|unknown||404
api.$ROOT|unknown||404"

printf '%-4s %-38s %-18s %-6s %-8s %-10s\n' "" "HOST" "PATH" "STATUS" "SITE" "TENANT"
while IFS='|' read -r host site tenant status; do
  check "$host" "/" "$status" "$site" "$tenant"
  check "$host" "/api/health" "200" "$site" "$tenant"
  if [ "$site" = "tenant" ]; then
    check "$host" "/employees/42" "200" "$site" "$tenant"
  fi
done <<< "$cases"

# Spoofing checks: client-supplied routing headers must not change the tenant.
first="${tenant_list[0]}"
echo
echo "Spoof checks (request $first.$ROOT with forged headers):"
check "$first.$ROOT" "/api/health" "200" "tenant" "$first" -H "x-tenant: evil"
check "$first.$ROOT" "/api/health" "200" "tenant" "$first" -H "x-site: admin"
# If this FAILs, the edge passes a client-supplied X-Forwarded-Host through to
# the app, and tenants can be spoofed. Inspect /debug to confirm. Skipped on
# localhost: with no proxy in front, the app always trusts the header.
if [ "$ROOT" = "localhost" ]; then
  echo "SKIP x-forwarded-host spoof check (no edge proxy on localhost)"
else
  check "$first.$ROOT" "/api/health" "200" "tenant" "$first" -H "x-forwarded-host: admin.$ROOT"
fi

echo
if [ "$failures" -eq 0 ]; then
  echo "All checks passed."
else
  echo "$failures check(s) FAILED."
  exit 1
fi
