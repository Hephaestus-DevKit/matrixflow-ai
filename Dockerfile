# MatrixFlow AI API — Runtime Docker Image
# Copy all source first, then install (so pnpm workspace symlinks are correct)
FROM node:22-alpine
RUN apk add --no-cache libc6-compat openssl python3 py3-pip
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app
# Copy workspace sources before installing so pnpm can create workspace links.
COPY . .
# Install python dependencies
RUN pip3 install --no-cache-dir --break-system-packages -r apps/sidecar/requirements.txt

# Install deps AFTER copy (creates correct workspace symlinks)
RUN pnpm install --frozen-lockfile
# Generate Prisma client (Linux x86_64 native engine)
RUN pnpm --filter @matrixflow/db exec prisma generate --schema prisma/schema.prisma
# Copy generated client into db/dist
RUN mkdir -p packages/db/dist/generated/client && cp -r packages/db/src/generated/client/* packages/db/dist/generated/client/

# Compile NestJS API backend and all its workspace dependencies (skips frontend next.js build)
RUN pnpm --filter @matrixflow/api... build
RUN pnpm --filter @matrixflow/worker... build

ENV NODE_ENV=production
EXPOSE 7860
CMD ["sh", "scripts/docker-start.sh"]
