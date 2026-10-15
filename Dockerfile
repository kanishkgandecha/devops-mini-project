# Base image can be overridden, e.g. --build-arg NODE_IMAGE=node:20-alpine
ARG NODE_IMAGE=node:22-alpine

# ---- Stage 1: install production dependencies ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 2: minimal runtime image ----
FROM ${NODE_IMAGE} AS runtime

# Version metadata is baked into the image at build time, so every image tag
# corresponds to exactly one application version.
ARG APP_VERSION=dev
ARG GIT_COMMIT=local
ARG BUILD_DATE=unknown
ARG SIMULATE_FAILURE=false

ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=${APP_VERSION} \
    GIT_COMMIT=${GIT_COMMIT} \
    BUILD_DATE=${BUILD_DATE} \
    SIMULATE_FAILURE=${SIMULATE_FAILURE}

LABEL org.opencontainers.image.title="version-app" \
      org.opencontainers.image.description="Kubernetes rolling update & rollback demo" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}"

WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Run as the unprivileged "node" user (uid 1000).
USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server.js"]
