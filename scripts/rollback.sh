#!/usr/bin/env bash
# Roll back to the previous revision, or to a specific revision number.
# Usage: scripts/rollback.sh [revision]
source "$(dirname "$0")/common.sh"

REVISION="${1:-}"
if [[ -n "$REVISION" ]]; then
  info "Rolling back to revision $REVISION..."
  k rollout undo "deployment/$DEPLOYMENT" --to-revision="$REVISION"
else
  info "Rolling back to the previous revision..."
  k rollout undo "deployment/$DEPLOYMENT"
fi
k rollout status "deployment/$DEPLOYMENT" --timeout=120s
ok "Now running $(k get deploy "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"
k rollout history "deployment/$DEPLOYMENT"
