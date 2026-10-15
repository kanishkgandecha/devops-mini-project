#!/usr/bin/env bash
# Continuously call the Service from inside the cluster and print which
# version / pod answered. Run this in a second terminal during an update to
# show that traffic shifts gradually and no request fails.
source "$(dirname "$0")/common.sh"

POD="traffic-watcher"
CLIENT_IMAGE="$(k get deploy "$DEPLOYMENT" -o jsonpath='{.spec.template.spec.containers[0].image}')"

cleanup() { k delete pod "$POD" --ignore-not-found --wait=false >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup
k wait --for=delete "pod/$POD" --timeout=30s >/dev/null 2>&1 || true

# Reuse the app image (already in the cluster) as a tiny HTTP client.
k run "$POD" --image="$CLIENT_IMAGE" --image-pull-policy=IfNotPresent --restart=Never \
  --env=SIMULATE_FAILURE=false --command -- node -e '
    let ok = 0, failed = 0;
    setInterval(async () => {
      const t = new Date().toISOString().slice(11, 19);
      try {
        const r = await fetch("http://version-app/api/version", { signal: AbortSignal.timeout(2000) });
        const d = await r.json();
        ok++;
        console.log(`${t}  v${d.version.padEnd(7)} ${d.pod.padEnd(36)} ok=${ok} failed=${failed}`);
      } catch (e) {
        failed++;
        console.log(`${t}  REQUEST FAILED (${e.message})  ok=${ok} failed=${failed}`);
      }
    }, 500);' >/dev/null

k wait --for=condition=Ready "pod/$POD" --timeout=60s >/dev/null
info "Polling http://version-app/api/version every 0.5s (Ctrl+C to stop)"
k logs -f "$POD"
