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

# Apply versioned, non-destructive production migrations. A failed migration
# must stop startup rather than launching against an unknown schema.
echo "Applying database migrations..."
./node_modules/.bin/prisma migrate deploy --schema packages/db/prisma/schema.prisma

echo "Starting Python Sidecar..."
export SIDECAR_PYTHON_URL=${SIDECAR_PYTHON_URL:-http://localhost:8001}
python3 apps/sidecar/main.py &
sidecar_pid=$!

cleanup() {
  trap - TERM INT EXIT
  for pid in "${api_pid:-}" "${worker_pid:-}" "${sidecar_pid:-}"; do
    [ -n "$pid" ] && kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup TERM INT EXIT

# Wait for sidecar to become ready
echo "Waiting for Python Sidecar..."
sidecar_ready=false
for i in $(seq 1 30); do
  if wget -qO- http://localhost:8001/health > /dev/null 2>&1; then
    echo "Python Sidecar is ready"
    sidecar_ready=true
    break
  fi
  sleep 1
done
if [ "$sidecar_ready" != "true" ]; then
  echo "Python Sidecar failed to become ready" >&2
  exit 1
fi

echo "Starting MatrixFlow API..."
export INTERNAL_API_URL=${INTERNAL_API_URL:-http://localhost:${PORT:-7860}/api/v1}
echo "Starting MatrixFlow Worker..."
node apps/worker/dist/main.js &
worker_pid=$!
node apps/api/dist/main.js &
api_pid=$!

while kill -0 "$sidecar_pid" 2>/dev/null && kill -0 "$worker_pid" 2>/dev/null && kill -0 "$api_pid" 2>/dev/null; do
  sleep 2
done

echo "A managed process exited; shutting down the combined container" >&2
exit 1
