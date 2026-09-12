#!/bin/sh
# ============================================================
# AGBE Family — point d'entrée du conteneur
# 1. Initialise la base SQLite du volume si elle est absente
# 2. Amorce le compte Admin Général si aucun membre n'existe
# 3. Démarre le serveur Next.js (standalone)
# ============================================================
set -e

DB="/app/db/custom.db"

if [ ! -f "$DB" ]; then
  echo "[entrypoint] Base absente — initialisation du schéma depuis la base vierge…"
  cp /app/db/pristine.db "$DB"
fi

echo "[entrypoint] Amorçage du compte administrateur (idempotent)…"
node /app/scripts/bootstrap-admin.mjs

echo "[entrypoint] Démarrage du serveur AGBE Family sur le port ${PORT:-3000}…"
exec node server.js
