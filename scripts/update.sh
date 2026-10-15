#!/usr/bin/env bash
# Perform a rolling update to a new image version.
# If the rollout fails (pods never become ready), roll back automatically.
# Usage: scripts/update.sh <version> ["change cause"] [--no-auto-rollback]
source "$(dirname "$0")/common.sh"

VERSION="${1:?usage: update.sh <version> [\"change cause\"] [--no-auto-rollback]}"
CAUSE="${2:-Rolling update to v$VERSION}"
AUTO_ROLLBACK="true"
[[ "${3:-}" == "--no-auto-rollback" ]] && AUTO_ROLLBACK="false"

CURRENT_IMAGE="$(k get deploy "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"
info "Current image: $CURRENT_IMAGE  ->  new image: $IMAGE_NAME:$VERSION"

# Change the image and record the change-cause in a single atomic patch,
# so the new revision shows a meaningful entry in `rollout history`.
k patch deployment "$DEPLOYMENT" --type=strategic -p "$(cat <<JSON
{
  "metadata": {"annotations": {"kubernetes.io/change-cause": "$CAUSE"}},
  "spec": {"template": {"spec": {"containers": [{"name": "$CONTAINER", "image": "$IMAGE_NAME:$VERSION"}]}}}
}
JSON
)"

info "Watching rolling update (maxSurge=1, maxUnavailable=0)..."
if k rollout status "deployment/$DEPLOYMENT" --timeout=120s; then
  ok "Rolled out v$VERSION successfully"
  k get pods -l app=version-app
  exit 0
fi

fail "Rollout of v$VERSION failed - new pods did not become ready."
k get pods -l app=version-app
if [[ "$AUTO_ROLLBACK" == "true" ]]; then
  warn "Automatically rolling back to the previous revision..."
  k rollout undo "deployment/$DEPLOYMENT"
  k rollout status "deployment/$DEPLOYMENT" --timeout=120s
  ok "Rolled back to $(k get deploy "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"
fi
exit 1
