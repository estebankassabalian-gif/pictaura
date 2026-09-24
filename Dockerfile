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
# Migrations AVANT le serveur, et l'echec est bloquant : pas de `|| echo`.
# Ce garde a deja transforme une migration ratee en panne silencieuse — le
# serveur demarrait avec un schema incoherent et toutes les lectures de la
# table concernee echouaient en production sans que rien ne l'annonce.
# Un demarrage refuse est visible immediatement, et Coolify laisse alors
# l'ancien conteneur servir : echouer bruyamment est strictement plus sur.
RUN printf '#!/bin/sh\nset -e\necho "Running Prisma migrations..."\nnode node_modules/prisma/build/index.js migrate deploy\necho "Starting server..."\nexec node server.js\n' > /app/start.sh && chmod +x /app/start.sh

USER nextjs

# Sonde de sante du conteneur. Coolify l'utilise au deploiement : un nouveau
# conteneur qui ne repond pas est ecarte et l'ancien continue de servir, au
# lieu de mettre en ligne une app cassee.
# En `node` et pas en curl/wget : l'image ne contient ni l'un ni l'autre
# (constate le 2026-09-24 — la sonde configuree cote Coolify faisait echouer
# TOUS les deploiements, rollback a chaque fois).
# `process.exitCode` plutot que `process.exit()` : couper le process pendant
# que la requete est encore ouverte provoque une erreur libuv et un code de
# sortie parasite, donc un conteneur declare malade a tort.
# start-period genereux : les migrations Prisma tournent avant le serveur.
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5   CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>{await r.text();process.exitCode=r.ok?0:1}).catch(()=>{process.exitCode=1})"

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["/app/start.sh"]
