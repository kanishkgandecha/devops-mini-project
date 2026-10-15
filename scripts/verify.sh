#!/usr/bin/env bash
# Verify that the Service is serving the expected version.
# Sends several requests through the Service (load-balanced across pods)
# and fails if any response reports a different version.
# Usage: scripts/verify.sh <expected-version> [requests]
source "$(dirname "$0")/common.sh"

EXPECTED="${1:?usage: verify.sh <expected-version> [requests]}"
COUNT="${2:-10}"

info "Checking that $COUNT requests to the Service all return v$EXPECTED..."
VERSIONS="$(k exec "deploy/$DEPLOYMENT" -- node -e "
  (async () => {
    for (let i = 0; i < $COUNT; i++) {
      const r = await fetch('http://$DEPLOYMENT/api/version');
      const d = await r.json();
      console.log(d.version + ' ' + d.pod);
    }
  })().catch((e) => { console.error(e.message); process.exit(1); });
")"
echo "$VERSIONS"

if echo "$VERSIONS" | awk '{print $1}' | grep -qv "^$EXPECTED\$"; then
  fail "Some responses did not come from v$EXPECTED"
  exit 1
fi
ok "All $COUNT responses served by v$EXPECTED"
