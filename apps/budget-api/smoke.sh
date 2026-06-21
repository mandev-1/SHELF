#!/usr/bin/env bash
# Smoke-test a deployed (or local) Budget API instance.
#
#   TOKEN=<api-token> ./smoke.sh                 # read-only suite vs the default BASE
#   BASE=http://localhost:8080 TOKEN=... ./smoke.sh
#   TOKEN=... ./smoke.sh --write                 # ALSO run a self-cleaning POST+DELETE roundtrip
#
# Exit code is 0 only if every check passes (handy for CI / a deploy gate).
# No secret is hardcoded here — pass TOKEN via the environment.
set -u

BASE="${BASE:-https://shelf-yh5b.onrender.com}"
TOKEN="${TOKEN:-}"
WRITE=0; [ "${1:-}" = "--write" ] && WRITE=1

if [ -z "$TOKEN" ]; then
  echo "WARNING: TOKEN is empty — the authed checks will return 401." >&2
fi
AUTH=(-H "Authorization: Bearer ${TOKEN}")

pass=0; fail=0
G="\033[32m"; R="\033[31m"; Z="\033[0m"

check () { # description, expected_code, curl-args...
  local desc="$1" want="$2"; shift 2
  local got; got=$(curl -s -m 30 -o /tmp/smoke_body -w "%{http_code}" "$@")
  if [ "$got" = "$want" ]; then
    printf "  ${G}PASS${Z}  %-44s (%s)\n" "$desc" "$got"; pass=$((pass+1))
  else
    printf "  ${R}FAIL${Z}  %-44s (got %s, want %s)\n" "$desc" "$got" "$want"; fail=$((fail+1))
    printf "        body: %s\n" "$(head -c 200 /tmp/smoke_body)"
  fi
}

echo "Testing $BASE"
echo "— liveness & auth gate —"
check "GET /healthz -> 200"                 200 "$BASE/healthz"
check "GET / (gated) -> 401"                401 "$BASE/"
check "GET /api/users no token -> 401"      401 "$BASE/api/users"
check "GET /api/users wrong token -> 401"   401 -H "Authorization: Bearer nope" "$BASE/api/users"

echo "— DB-backed reads (with token) —"
check "GET /api/users -> 200"               200 "${AUTH[@]}" "$BASE/api/users"
check "GET /api/budget -> 200"              200 "${AUTH[@]}" "$BASE/api/budget"
check "GET /api/trips -> 200"               200 "${AUTH[@]}" "$BASE/api/trips"

echo "— error handling —"
check "GET /api/nope -> 404"                404 "${AUTH[@]}" "$BASE/api/nope"
check "DELETE /api/users (no id) -> 405"    405 -X DELETE "${AUTH[@]}" "$BASE/api/users"

if [ "$WRITE" = 1 ]; then
  echo "— write roundtrip (creates then deletes a temp user) —"
  id=$(curl -s -m 30 "${AUTH[@]}" -H "Content-Type: application/json" \
         -d '{"name":"__smoke_test__"}' "$BASE/api/users" \
       | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  if [ -n "$id" ]; then
    printf "  ${G}PASS${Z}  POST /api/users created %s\n" "$id"; pass=$((pass+1))
    check "DELETE /api/users/<id> -> 204"   204 -X DELETE "${AUTH[@]}" "$BASE/api/users/$id"
  else
    printf "  ${R}FAIL${Z}  POST /api/users returned no id\n"; fail=$((fail+1))
  fi
fi

echo
echo "Result: ${pass} passed, ${fail} failed"
[ "$fail" = 0 ]
