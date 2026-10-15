#!/usr/bin/env bash
# Initial deployment of the manifests in k8s/ (namespace, deployment, service).
source "$(dirname "$0")/common.sh"

info "Applying Kubernetes manifests..."
kubectl --context "$KUBE_CONTEXT" apply -k "$PROJECT_ROOT/k8s"
k rollout status "deployment/$DEPLOYMENT" --timeout=120s
k get pods -l app=version-app -o wide
ok "Deployment ready"
