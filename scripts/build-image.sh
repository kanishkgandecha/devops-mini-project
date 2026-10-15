#!/usr/bin/env bash
# Build an application image locally and load it into the cluster
# (minikube by default, or kind when KIND_CLUSTER is set - used in CI).
# Usage: scripts/build-image.sh <version> [--broken]
source "$(dirname "$0")/common.sh"

VERSION="${1:?usage: build-image.sh <version> [--broken]}"
FAILURE="false"
[[ "${2:-}" == "--broken" ]] && FAILURE="true"

COMMIT="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo local)"

info "Building $IMAGE_NAME:$VERSION (simulate failure: $FAILURE)..."
docker build -q \
  --build-arg APP_VERSION="$VERSION" \
  --build-arg GIT_COMMIT="$COMMIT" \
  --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --build-arg SIMULATE_FAILURE="$FAILURE" \
  ${NODE_IMAGE:+--build-arg NODE_IMAGE="$NODE_IMAGE"} \
  -t "$IMAGE_NAME:$VERSION" "$PROJECT_ROOT"

if [[ -n "${KIND_CLUSTER:-}" ]]; then
  info "Loading $IMAGE_NAME:$VERSION into kind cluster '$KIND_CLUSTER'..."
  kind load docker-image "$IMAGE_NAME:$VERSION" --name "$KIND_CLUSTER"
else
  info "Loading $IMAGE_NAME:$VERSION into minikube profile '$PROFILE'..."
  minikube -p "$PROFILE" image load "$IMAGE_NAME:$VERSION"
fi
ok "Image $IMAGE_NAME:$VERSION is available to the cluster"
