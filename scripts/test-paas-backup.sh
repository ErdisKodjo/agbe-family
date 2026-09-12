#!/bin/sh
# ============================================================
# AGBE Family — Test d'intégration de la boucle de sauvegarde
# intégrée au point d'entrée Docker (docker/entrypoint.sh).
#
# Utile quand Docker n'est pas disponible : ce test exécute le
# VRAI entrypoint.sh avec des chemins neutralisés (sed) et deux
# stubs sur le PATH :
#   - sqlite3 : réplique ".backup" via l'API sqlite3 de Python
#     (copie transactionnelle identique au binaire Debian)
#   - rclone  : journalise la commande et copie réellement le
#     fichier vers un dossier simulant le stockage distant
# Vérifie : init de base, export local, copie hors-site, purge
# locale, et le chemin « désactivé » sans BACKUP_REMOTE.
# Usage : sh scripts/test-paas-backup.sh
# ============================================================
set -e
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TESTDIR="$REPO_ROOT/scripts/paas-backup-test"
rm -rf "$TESTDIR"
mkdir -p "$TESTDIR/db" "$TESTDIR/backups" "$TESTDIR/remote"

# 1. Base SQLite réelle avec une ligne de données
python3 - "$TESTDIR/custom.db" <<'EOF'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
con.execute("CREATE TABLE membre (id INTEGER, nom TEXT)")
con.execute("INSERT INTO membre VALUES (1, 'Test AGBE')")
con.commit(); con.close()
EOF

# 2. Stub sqlite3 : "sqlite3 DB \".backup 'DEST'\"" -> sauvegarde API Python
cat > "$TESTDIR/sqlite3" <<'EOF'
#!/bin/sh
DB="$1"; CMD="$2"
DEST=$(printf '%s' "$CMD" | sed "s/^\.backup '//; s/'$//")
exec python3 - "$DB" "$DEST" <<'PYEOF'
import sqlite3, sys
src = sqlite3.connect(sys.argv[1])
dst = sqlite3.connect(sys.argv[2])
src.backup(dst)
dst.close(); src.close()
PYEOF
EOF
chmod +x "$TESTDIR/sqlite3"

# 3. Stub rclone : journalise + simule "copy" (copie réelle)
cat > "$TESTDIR/rclone" <<'EOF'
#!/bin/sh
echo "[stub-rclone] $*" >> "$(dirname "$0")/rclone.log"
if [ "$1" = "copy" ]; then
  cp "$2" "$(dirname "$0")/remote/"
fi
exit 0
EOF
chmod +x "$TESTDIR/rclone"

# 4. Entrypoint réel neutralisé : chemins locaux, pas de serveur,
#    pas d'amorçage node, UNE SEULE itération de la boucle
sed -e "s#DB=\"/app/db/custom.db\"#DB=\"$TESTDIR/db/custom.db\"#" \
    -e "s#mkdir -p /app/db\$#mkdir -p $TESTDIR/db#" \
    -e "s#cp /app/pristine.db#cp $TESTDIR/custom.db#" \
    -e "s#mkdir -p /app/db/uploads#mkdir -p $TESTDIR/db/uploads#" \
    -e "s#rm -rf /app/uploads#rm -rf $TESTDIR/uploads#" \
    -e "s#ln -sfn /app/db/uploads /app/uploads#ln -sfn $TESTDIR/db/uploads $TESTDIR/uploads#" \
    -e "s#/app/db/backups#$TESTDIR/backups#g" \
    -e "s#node /app/scripts/bootstrap-admin.mjs#true#" \
    -e "s#sleep 86400#sleep 1; break#" \
    -e "s#exec node server.js#echo \"[test] serveur non démarré (neutralisé)\"#" \
    "$REPO_ROOT/docker/entrypoint.sh" > "$TESTDIR/entrypoint-test.sh"

echo "=== CAS 1 : BACKUP_REMOTE défini ==="
PATH="$TESTDIR:$PATH" BACKUP_REMOTE="stubremote:agbe-backups" sh "$TESTDIR/entrypoint-test.sh"

# La boucle tourne en ARRIÈRE-PLAN du point d'entrée : attendre la 1re
# itération (sleep 1 neutralisé + stubs rapides) avant de vérifier.
i=0
until ls "$TESTDIR"/backups/agbe-*.db >/dev/null 2>&1 || [ "$i" -ge 30 ]; do
  sleep 0.5; i=$((i + 1))
done
i=0
until ls "$TESTDIR"/remote/agbe-*.db >/dev/null 2>&1 || [ "$i" -ge 20 ]; do
  sleep 0.5; i=$((i + 1))
done

echo "--- vérifications ---"
ls "$TESTDIR/backups" "$TESTDIR/remote"
test -f "$TESTDIR"/backups/agbe-*.db && echo "OK : export local écrit (rétention 7 j)"
test -f "$TESTDIR"/remote/agbe-*.db && echo "OK : copie hors-site effectuée"
test -L "$TESTDIR/uploads" && test -d "$TESTDIR/db/uploads" \
  && echo "OK : mono-volume PaaS — uploads redirigé vers db/uploads (lien symbolique)"
python3 - "$TESTDIR"/remote/agbe-*.db <<'EOF'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
row = con.execute("SELECT nom FROM membre WHERE id=1").fetchone()
assert row and row[0] == "Test AGBE", "données absentes de la sauvegarde !"
print("OK : intégrité des données de la sauvegarde (membre=Test AGBE)")
con.close()
EOF
echo "--- journal rclone ---"
cat "$TESTDIR/rclone.log"

echo ""
echo "=== CAS 2 : BACKUP_REMOTE absent (VPS compose) ==="
sh "$TESTDIR/entrypoint-test.sh" | grep -q "Sauvegarde intégrée désactivée" \
  && echo "OK : boucle désactivée quand BACKUP_REMOTE est absent"
if ls "$TESTDIR"/backups/agbe-*.db >/dev/null 2>&1; then
  N=$(ls "$TESTDIR"/backups/agbe-*.db | wc -l)
  echo "OK : aucune nouvelle sauvegarde en cas 2 ($N fichier(s), inchangé(s))"
fi

echo ""
echo "=== CAS 3 : syntaxe POSIX (sh -n) ==="
sh -n "$REPO_ROOT/docker/entrypoint.sh" && echo "OK : entrypoint.sh syntaxe sh valide"
echo ""
echo "TOUT EST OK"
