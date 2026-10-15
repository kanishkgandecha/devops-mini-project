#!/usr/bin/env bash
# Open the application in the browser through the NodePort Service.
source "$(dirname "$0")/common.sh"
minikube -p "$PROFILE" service "$DEPLOYMENT" -n "$NAMESPACE"
