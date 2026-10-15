#!/usr/bin/env bash
# Shared settings for all scripts. Every kubectl call names the context
# explicitly so the scripts never touch any other cluster in your kubeconfig.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${MINIKUBE_PROFILE:-devops-mini}"
KUBE_CONTEXT="${KUBE_CONTEXT:-$PROFILE}"
NAMESPACE="version-app"
DEPLOYMENT="version-app"
CONTAINER="version-app"
IMAGE_NAME="version-app"

k() { kubectl --context "$KUBE_CONTEXT" -n "$NAMESPACE" "$@"; }

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m✔\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m!\033[0m  %s\n' "$*"; }
fail()  { printf '\033[1;31m✘\033[0m  %s\n' "$*" >&2; }
