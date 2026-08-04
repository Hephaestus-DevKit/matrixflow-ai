# syntax=docker/dockerfile:1.7
FROM node:26.5.1-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/ai-gateway/package.json ./packages/ai-gateway/
COPY packages/workflow-engine/package.json ./packages/workflow-engine/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm db:generate
RUN pnpm --filter @matrixflow/api... build
RUN pnpm --filter @matrixflow/api deploy --prod --legacy /prod/api \
    && rm -rf /prod/api/src /prod/api/test /prod/api/.turbo

FROM node:26.5.1-alpine AS runner
RUN apk add --no-cache dumb-init libc6-compat openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /prod/api/ ./
USER node
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
