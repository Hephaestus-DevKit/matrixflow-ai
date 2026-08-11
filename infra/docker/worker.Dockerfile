# syntax=docker/dockerfile:1.7
FROM node:26.7.0-alpine AS base
RUN npm install --global corepack@0.35.0 \
    && corepack prepare pnpm@11.9.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

FROM base AS builder
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json .npmrc ./
COPY apps/worker/package.json ./apps/worker/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY apps/worker ./apps/worker
RUN pnpm --filter @matrixflow/worker build
RUN pnpm --filter @matrixflow/worker deploy --prod --legacy /prod/worker \
    && rm -rf /prod/worker/src /prod/worker/test /prod/worker/.turbo

FROM node:26.7.0-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /prod/worker/ ./
USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
