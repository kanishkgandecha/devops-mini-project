# Live Demonstration Guide (≈ 10 minutes)

## Before the demo (do this 10 minutes early)

```bash
open -a Docker                       # wait until Docker Desktop is running
./scripts/setup-cluster.sh
./scripts/build-image.sh 1.0.0
./scripts/build-image.sh 2.0.0
./scripts/build-image.sh 3.0.0 --broken
./scripts/teardown.sh                # start from a clean namespace
./scripts/deploy.sh                  # v1.0.0 running on 4 pods
```

Keep three terminals and one browser window open:

| Window | Command |
|---|---|
| Terminal A | commands below |
| Terminal B | `./scripts/watch-traffic.sh` (live in-cluster traffic) |
| Terminal C | `./scripts/open-app.sh` (leave running; it opens the browser) |
| Browser | GitHub repo → **Actions** tab, showing the last green pipeline run |

> If Docker Hub is unreachable on the college network, pull the same Node image from a mirror:
> `export NODE_IMAGE=public.ecr.aws/docker/library/node:22-alpine` (or `mirror.gcr.io/library/node:22-alpine`),
> then run the `build-image.sh` commands. Or build on a phone hotspot.

## The dashboard

Keep the browser (from `./scripts/open-app.sh`) visible throughout. It updates itself every 1–2 seconds:
the **Rollout status** tracker and progress bars move during an update, the **Pods** grid shows old and new pods
side by side (the faulty v3 pod appears dashed and red), the **Revisions** table gains a row per change, and
the **Kubernetes events** panel shows scaling events and "Readiness probe failed" warnings.

## Script

| # | Say | Do |
|---|---|---|
| 1 | "This is our repository: app, tests, Dockerfile, Kubernetes manifests and pipeline." | Show the GitHub repo |
| 2 | "Every push runs this 3-stage pipeline." | Actions tab → open the last run → show the three jobs and the **Deployment report** summary |
| 3 | "Tests and lint run first; coverage must be above 80 %." | `npm test` |
| 4 | "Version 1 is running on 4 pods behind a Service." | `./scripts/status.sh`, show the browser (blue v1.0.0) |
| 5 | "Now we release v2 with a rolling update. maxSurge 1, maxUnavailable 0, so capacity never drops." | `./scripts/update.sh 2.0.0 "Release v2.0.0 - new green UI"`. Point at Terminal B: v1 and v2 mixed, `failed=0` |
| 6 | "Each revision is kept as a ReplicaSet with a change-cause." | `./scripts/status.sh` |
| 7 | "Now a faulty release. Its readiness probe returns 503, so Kubernetes never sends it traffic." | `./scripts/update.sh 3.0.0 "Release v3.0.0 - faulty build"` |
| 8 | (while waiting ~60 s) "The old pods are untouched; users still get v2. When the progress deadline passes, our script runs `rollout undo`." | `kubectl --context devops-mini -n version-app get pods` |
| 9 | "We can also roll back to any earlier revision." | `./scripts/rollback.sh 1`, then refresh the browser (blue again) |
| 10 | "Throughout all of this, not a single request failed." | Point at the `failed=0` counter in Terminal B |

## Likely viva questions

- **Rolling update vs. recreate?** Recreate kills all old pods first, so there is downtime. Rolling update replaces them gradually.
- **What do maxSurge / maxUnavailable do?** maxSurge is how many extra pods may exist during the update. maxUnavailable is how many may be missing. 1 / 0 means zero downtime at the cost of one extra pod.
- **Why a readiness probe and not just a liveness probe?** Liveness restarts a dead container. Readiness decides whether a pod gets traffic. A bad release can be alive but not ready.
- **How does Kubernetes know the rollout failed?** `progressDeadlineSeconds: 60`. With no progress in that time, the Deployment condition becomes `ProgressDeadlineExceeded` and `kubectl rollout status` exits non-zero.
- **Where are old versions stored?** As scaled-to-zero ReplicaSets, up to `revisionHistoryLimit` (10).
- **Why does revision 1 become revision 5 after a rollback?** A rollback re-applies the old pod template as a *new* revision. The old number disappears from the history.
- **Why the preStop sleep?** It gives the Service time to remove the pod's endpoint before the app receives SIGTERM, so in-flight requests aren't dropped.
