#!/usr/bin/env bash
# Show the deployment, its ReplicaSets (one per revision), pods and history.
source "$(dirname "$0")/common.sh"

info "Deployment"
k get deploy "$DEPLOYMENT" -o wide
echo
info "ReplicaSets (each one is a stored revision)"
k get rs -l app=version-app \
  -o custom-columns='NAME:.metadata.name,REVISION:.metadata.annotations.deployment\.kubernetes\.io/revision,IMAGE:.spec.template.spec.containers[0].image,DESIRED:.spec.replicas,READY:.status.readyReplicas'
echo
info "Pods"
k get pods -l app=version-app -o custom-columns='NAME:.metadata.name,IMAGE:.spec.containers[0].image,READY:.status.containerStatuses[0].ready,STATUS:.status.phase'
echo
info "Rollout history"
k rollout history "deployment/$DEPLOYMENT"
