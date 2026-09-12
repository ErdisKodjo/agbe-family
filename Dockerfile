# ============================================================
# AGBE Family (PGF) — Image Docker de production
# Next.js 16 (sortie standalone) + Prisma/SQLite
# Construction : docker build -t agbe-family .
# Exécution   : docker compose up -d
# ============================================================

# ---------- Étape 1 : dépendances + build ----------
FROM oven/bun:1 AS build
WORKDIR /app

# Dépendances (couche cachée tant que package.json/bun.lock ne changent pas)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Sources
COPY . .

# Client Prisma (généré avant le build Next)
RUN bunx prisma generate

# Build Next.js standalone + copie statique/public (cf. script "build" du package.json)
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Base SQLite « vierge » avec le schéma appliqué (servira à initialiser le volume)
RUN mkdir -p db && DATABASE_URL=file:/app/db/pristine.db bunx prisma db push --skip-generate

# ---------- Étape 2 : image d'exécution ----------
# Debian (et non alpine) : les moteurs Prisma compilés à l'étape 1 (oven/bun = Debian,
# openssl 3.0.x) sont compatibles linux-gnu. Alpine (musl) les rejetterait.
FROM node:22-slim
WORKDIR /app

# OpenSSL + fuse horaire + healthcheck via node (wget/curl absents de slim)
# sqlite3 + rclone : boucle de sauvegarde intégrée (PaaS Railway/Render,
# cf. docker/entrypoint.sh) + inspection de la base via le shell de la plateforme
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl ca-certificates tzdata sqlite3 rclone \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/db/custom.db \
    NEXT_TELEMETRY_DISABLED=1

# Serveur standalone (contient node_modules élagués + .next/static + public)
COPY --from=build /app/.next/standalone ./

# Ceinture et bretelles : moteurs Prisma explicites (traçage autonome parfois incomplet)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Base vierge, point d'entrée et script d'amorçage du compte admin.
# ⚠️ pristine.db est copié à la racine /app (et NON dans /app/db) : sur les PaaS
# (Railway/Render), le volume monté sur /app/db masque le contenu de l'image à
# ce chemin — un fichier placé dans /app/db serait invisible au 1er démarrage.
COPY --from=build /app/db/pristine.db ./pristine.db
COPY docker/entrypoint.sh /app/entrypoint.sh
COPY scripts/bootstrap-admin.mjs /app/scripts/bootstrap-admin.mjs
RUN chmod +x /app/entrypoint.sh && mkdir -p /app/uploads

# Volumes persistants : base SQLite + preuves de paiement
VOLUME ["/app/db", "/app/uploads"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["/app/entrypoint.sh"]
