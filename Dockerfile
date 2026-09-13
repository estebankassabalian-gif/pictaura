FROM node:20-alpine AS base

# ─── Deps ─────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ─── Builder ──────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Runner ───────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma (migrations + client + all transitive deps)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Entrypoint script: migrate then start
# ETAPE TRANSITOIRE — retiree au commit suivant.
# La migration 20260912120000_add_brand_logo_key a echoue en cours
# d'application le 2026-09-12. Prisma en garde la trace dans
# _prisma_migrations et refuse desormais d'appliquer QUOI QUE CE SOIT
# (erreur P3009 a chaque demarrage) : toute evolution de schema est gelee.
# `migrate resolve --rolled-back` efface cette trace. Le `|| true` est
# volontaire : aux demarrages suivants il n'y aura plus rien a resoudre.
RUN printf '#!/bin/sh\nset -e\necho "Resolving failed migration (one-shot)..."\nnode node_modules/prisma/build/index.js migrate resolve --rolled-back 20260912120000_add_brand_logo_key || true\necho "Running Prisma migrations..."\nnode node_modules/prisma/build/index.js migrate deploy || echo "Migration warning (may already be applied)"\necho "Starting server..."\nexec node server.js\n' > /app/start.sh && chmod +x /app/start.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["/app/start.sh"]
