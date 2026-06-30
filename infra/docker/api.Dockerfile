# Multi-stage Dockerfile for NestJS API
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/ai-gateway/package.json ./packages/ai-gateway/
COPY packages/workflow-engine/package.json ./packages/workflow-engine/
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

FROM deps AS builder
COPY . .
RUN npx -p prisma@6.19.3 prisma generate --schema packages/db/prisma/schema.prisma
RUN pnpm --filter @matrixflow/shared build 2>/dev/null || true
RUN pnpm --filter @matrixflow/ai-gateway build 2>/dev/null || true
RUN pnpm --filter @matrixflow/workflow-engine build 2>/dev/null || true
RUN pnpm --filter @matrixflow/db build 2>/dev/null || true
RUN pnpm --filter @matrixflow/api build 2>/dev/null || true
# Fallback: direct tsc if nest build failed
RUN if [ ! -f apps/api/dist/main.js ]; then cd apps/api && npx tsc --project tsconfig.json; fi

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/ai-gateway/dist ./packages/ai-gateway/dist
COPY --from=builder /app/packages/workflow-engine/dist ./packages/workflow-engine/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/db/package.json ./packages/db/
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
