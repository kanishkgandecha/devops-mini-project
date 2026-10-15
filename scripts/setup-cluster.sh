#!/usr/bin/env bash
# Start a dedicated local Kubernetes cluster with minikube.
source "$(dirname "$0")/common.sh"

if minikube -p "$PROFILE" status >/dev/null 2>&1; then
  ok "minikube profile '$PROFILE' is already running"
else
  info "Starting minikube profile '$PROFILE'..."
  minikube start -p "$PROFILE" --driver=docker --cpus=2 --memory=2200 --cni=bridge --keep-context
fi
kubectl --context "$KUBE_CONTEXT" get nodes
