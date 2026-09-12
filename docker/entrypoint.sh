#!/bin/sh
# ============================================================
# AGBE Family — point d'entrée du conteneur
# 1. Initialise la base SQLite du volume si elle est absente
# 2. Amorce le compte Admin Général si aucun membre n'existe
# 3. Démarre la boucle de sauvegarde hors-site (optionnelle)
# 4. Démarre le serveur Next.js (standalone)
# ============================================================
set -e
DB="/app/db/custom.db"

if [ ! -f "$DB" ]; then
  echo "[entrypoint] Base absente — initialisation du schéma depuis la base vierge…"
  # pristine.db vit hors de /app/db : un volume PaaS monté sur /app/db masque
  # le contenu de l'image à ce chemin (volume vide au premier montage).
  mkdir -p /app/db
  cp /app/pristine.db "$DB"
fi

echo "[entrypoint] Amorçage du compte administrateur (idempotent)…"
node /app/scripts/bootstrap-admin.mjs

# ------------------------------------------------------------
# Sauvegarde intégrée — pour les PaaS (Railway / Render) qui
# n'exécutent pas docker-compose (donc pas de conteneur « backup »).
# Activée uniquement si BACKUP_REMOTE est défini (rclone <remote>:<chemin>).
# Chaque jour : export SQLite sûr (".backup", lectures non bloquées)
# vers /app/db/backups (volume persistant) + copie hors-site rclone
# + rétention 30 j hors-site / 7 j en local.
# Sur VPS, docker-compose ne passe pas BACKUP_REMOTE au service app :
# la boucle reste éteinte et le conteneur dédié « backup » fait le travail.
# ------------------------------------------------------------
if [ -n "$BACKUP_REMOTE" ]; then
  echo "[entrypoint] Sauvegarde hors-site activée : $BACKUP_REMOTE"
  (
    mkdir -p /app/db/backups
    while true; do
      STAMP=$(date +%Y%m%d-%H%M%S)
      DEST="/app/db/backups/agbe-$STAMP.db"
      if sqlite3 "$DB" ".backup '$DEST'"; then
        echo "[backup] $DEST écrit"
        rclone copy "$DEST" "$BACKUP_REMOTE" \
          && rclone delete --min-age 30d --include 'agbe-*.db' "$BACKUP_REMOTE" \
          && echo "[backup] copie hors-site : $BACKUP_REMOTE" \
          || echo "[backup] AVERTISSEMENT : échec de la copie hors-site (vérifiez la configuration rclone)"
        find /app/db/backups -name 'agbe-*.db' -mtime +7 -delete
      else
        echo "[backup] AVERTISSEMENT : échec de l'export sqlite3 (itération $STAMP)"
      fi
      sleep 86400
    done
  ) &
else
  echo "[entrypoint] Sauvegarde intégrée désactivée (BACKUP_REMOTE absent) — cf. docs/DEPLOIEMENT.md §8"
fi

echo "[entrypoint] Démarrage du serveur AGBE Family sur le port ${PORT:-3000}…"
exec node server.js
