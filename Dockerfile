FROM node:20-alpine AS base
RUN corepack enable

# ── 1. Install dependencies (cached layer) ────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy manifests only — maximises layer cache reuse
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json     ./packages/web/
COPY packages/agents/package.json  ./packages/agents/
COPY packages/core/package.json    ./packages/core/
# tools package (optional — copy only if it exists via glob workaround)
COPY packages/tools/package.json   ./packages/tools/

RUN pnpm install --frozen-lockfile

# ── 2. Build ──────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules           ./node_modules
COPY --from=deps /app/packages               ./packages
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client then build Next.js
RUN pnpm --filter @velo/web exec prisma generate
RUN pnpm --filter @velo/web build

# ── 3. Production runner ──────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# next.config.js must have output: 'standalone' for this to work
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static     ./packages/web/.next/static
COPY --from=builder /app/packages/web/public           ./packages/web/public

# .velo data dir (uploads, connector-env) — mount as a volume in docker-compose
RUN mkdir -p /app/.velo/uploads /app/.velo/chats

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "packages/web/server.js"]
