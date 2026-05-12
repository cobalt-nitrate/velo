#!/bin/sh
set -e

# Run Prisma migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."
  chmod +x ./node_modules/.bin/prisma
  ./node_modules/.bin/prisma migrate deploy --schema=packages/web/prisma/schema.prisma || true
fi

# Start the Next.js standalone server
echo "Starting Velo server..."
exec node -r packages/web/lib/register-env.cjs packages/web/server.js
