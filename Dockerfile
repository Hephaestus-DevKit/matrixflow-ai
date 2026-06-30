# MatrixFlow AI API — Runtime Docker Image
# Copy all source first, then install (so pnpm workspace symlinks are correct)
FROM node:20-alpine
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app
# Copy everything first (includes pre-built dist from local build)
COPY . .
# Install deps AFTER copy (creates correct workspace symlinks)
RUN pnpm install --no-frozen-lockfile
# Generate Prisma client (Linux x86_64 native engine)
RUN npx -p prisma@6.19.3 prisma generate --schema packages/db/prisma/schema.prisma
# Copy generated client into db/dist
RUN mkdir -p packages/db/dist/generated/client && cp -r packages/db/src/generated/client/* packages/db/dist/generated/client/ || true

# Compile all workspace packages (NestJS backend API and dependencies)
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 7860
CMD ["sh", "scripts/docker-start.sh"]
