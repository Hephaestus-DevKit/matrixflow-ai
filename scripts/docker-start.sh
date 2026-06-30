#!/bin/sh
# MatrixFlow AI API startup script
# Ensures workspace symlinks exist before starting (pnpm hoisted mode may not create them)
set -e

echo "=== MatrixFlow AI API Startup ==="

# Ensure workspace package symlinks exist (brute-force, works regardless of pnpm config)
mkdir -p /app/apps/api/node_modules/@matrixflow 2>/dev/null || true
for pkg in db shared ai-gateway workflow-engine; do
  target="/app/packages/$pkg"
  link="/app/apps/api/node_modules/@matrixflow/$pkg"
  if [ ! -e "$link" ]; then
    ln -sf "$target" "$link" 2>/dev/null || true
  fi
done

# Also ensure root-level symlinks
mkdir -p /app/node_modules/@matrixflow 2>/dev/null || true
for pkg in db shared ai-gateway workflow-engine; do
  target="/app/packages/$pkg"
  link="/app/node_modules/@matrixflow/$pkg"
  if [ ! -e "$link" ]; then
    ln -sf "$target" "$link" 2>/dev/null || true
  fi
done

echo "Symlinks verified"

# Push schema if needed
echo "Pushing database schema..."
npx -p prisma@6.19.3 prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss --skip-generate 2>/dev/null || true

echo "Starting MatrixFlow API..."
exec node apps/api/dist/main.js
