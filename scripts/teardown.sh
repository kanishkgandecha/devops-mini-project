#!/usr/bin/env bash
# Remove the application, and optionally delete the minikube cluster.
# Usage: scripts/teardown.sh [--delete-cluster]
source "$(dirname "$0")/common.sh"

kubectl --context "$KUBE_CONTEXT" delete namespace "$NAMESPACE" --ignore-not-found
if [[ "${1:-}" == "--delete-cluster" ]]; then
  minikube delete -p "$PROFILE"
fi
ok "Cleaned up"
