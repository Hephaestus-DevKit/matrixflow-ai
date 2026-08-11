# syntax=docker/dockerfile:1.7
# Combined image for single-container platforms such as Hugging Face Spaces.
# Normal deployments should use the separate API, Worker and Sidecar images.
FROM node:26.7.0-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
RUN npm install --global corepack@0.35.0 \
    && corepack prepare pnpm@11.9.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm db:generate
RUN pnpm --filter @matrixflow/api... build && pnpm --filter @matrixflow/worker build

FROM node:26.7.0-alpine AS runner
RUN apk add --no-cache dumb-init libc6-compat openssl python3 py3-pip
RUN npm install --global corepack@0.35.0 \
    && corepack prepare pnpm@11.9.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
WORKDIR /app
COPY apps/sidecar/requirements.txt /tmp/sidecar-requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip3 install --break-system-packages --require-hashes -r /tmp/sidecar-requirements.txt \
    && rm /tmp/sidecar-requirements.txt
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=node:node /app/apps/sidecar ./apps/sidecar
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=node:node /app/scripts/docker-start.sh ./scripts/docker-start.sh
USER node
EXPOSE 7860
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "scripts/docker-start.sh"]
