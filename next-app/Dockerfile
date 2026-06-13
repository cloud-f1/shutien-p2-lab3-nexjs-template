# syntax=docker/dockerfile:1

# ─── deps ──────────────────────────────────────────────────────────────────────
# Install ALL dependencies (incl. devDeps) — needed for the build and for the
# migrate/seed one-shot (drizzle-kit + tsx are devDeps).
FROM node:22-alpine AS deps
WORKDIR /app

# Enable Corepack-managed pnpm (version pinned by packageManager / lockfile).
RUN corepack enable

# libc6-compat keeps some native Node addons happy on Alpine.
RUN apk add --no-cache libc6-compat

# Copy only manifest + lockfile first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

RUN pnpm install --frozen-lockfile

# ─── builder ───────────────────────────────────────────────────────────────────
# Builds the app (produces .next/standalone) and retains source + node_modules
# so this same image can run drizzle-kit migrate + tsx seed.
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable
RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Skip Next.js telemetry during build.
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time placeholders. `next build` eagerly evaluates server modules
# (e.g. lib/db.ts throws if DATABASE_URL is unset) during page-data collection,
# but the postgres client connects lazily — no DB is contacted at build time.
# Real values are injected at runtime via docker-compose env.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV AUTH_SECRET=build-time-placeholder-secret
ENV AUTH_TRUST_HOST=true

RUN pnpm build

# ─── runner ────────────────────────────────────────────────────────────────────
# Minimal runtime image serving the standalone server as a non-root user.
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone output: server.js + traced node_modules at the app root.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets are NOT bundled into standalone — copy them explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
