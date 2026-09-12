# Déploiement AGBE Family — Guide pas-à-pas

Ce document décrit la mise en production de la plateforme **AGBE Family (PGF)** sur un
serveur dédié (VPS), avec Docker, Nginx et HTTPS. Le plan d'architecture et la
comparaison des hébergeurs figurent dans le document *Plan de déploiement AGBE Family*
(PDF) livré avec ce guide.

## 1. Vue d'ensemble de l'architecture

```
            Internet
               │  (HTTPS — Let's Encrypt)
        ┌──────▼──────┐
        │    Nginx    │  reverse proxy, gzip, cache statique,
        │  (port 443) │  limitation de débit sur /api/auth/login
        └──────┬──────┘
               │  proxy_pass http://127.0.0.1:3000
        ┌──────▼──────────────────────────────┐
        │  Conteneur Docker « agbe-family »   │
        │  Next.js 16 standalone (node:22)    │
        │  ├─ volume agbe_db      → /app/db   │  base SQLite
        │  └─ volume agbe_uploads → /app/uploads │ preuves de paiement
        └─────────────────────────────────────┘
        ┌─────────────────────────────────────┐
        │  Conteneur « agbe-backup »          │  sauvegarde SQLite quotidienne,
        │  alpine + sqlite3 + rclone          │  rétention 30 jours (./backups/)
        │                                     │  copie hors-site quotidienne (option)
        └─────────────────────────────────────┘
```

Fichiers fournis dans le dépôt :

| Fichier | Rôle |
|---|---|
| `Dockerfile` | Image de production multi-étapes (build bun → runtime node) |
| `docker-compose.yml` | Orchestration : application + sauvegardes automatiques |
| `docker/entrypoint.sh` | Initialisation de la base + amorçage admin + démarrage |
| `scripts/bootstrap-admin.mjs` | Création idempotente du compte Admin Général + activation du mode WAL |
| `deploy/nginx.conf` | Reverse proxy HTTPS prêt à l'emploi |
| `deploy/rclone.conf.example` | Modèle de configuration pour la copie hors-site des sauvegardes |
| `.env.example` | Modèle de variables d'environnement |

## 2. Prérequis serveur

- Un VPS Debian 12 ou Ubuntu 22.04/24.04. **Dimensionnement pour la famille
  (400+ membres)** : 4 vCPU / 8 Go RAM recommandés (Hetzner CX32 ou CAX21 ≈ 9 €/mois,
  OVHcloud équivalent) — la machine absorbe alors les pics d'annonces (jusqu'à ~80
  sessions simultanées) sans changer de formule avant longtemps. Une offre
  2 vCPU / 4 Go (Hetzner CX22 ≈ 4,5 €) reste un plancher acceptable pour un
  lancement à budget serré — le passage à 4 vCPU se fait en 10 minutes, sans
  migration (cf. le PDF de plan pour le détail). Accès root ou sudo requis.
- Un nom de domaine pointant vers l'adresse IP du serveur (enregistrement **A**),
  par exemple `agbe.family`.
- Les paquets : `docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git`.

```bash
# Debian/Ubuntu — installation des prérequis
sudo apt update
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git
sudo usermod -aG docker $USER   # puis déconnexion/reconnexion
```

## 3. Installation

### 3.1 Récupérer le code

```bash
sudo mkdir -p /opt/agbe-family && sudo chown $USER /opt/agbe-family
cd /opt/agbe-family
git clone https://github.com/ErdisKodjo/agbe-family.git .
```

### 3.2 Configurer l'environnement

```bash
cp .env.example .env
nano .env
```

Renseignez au minimum le compte administrateur créé au premier démarrage :

```env
ADMIN_PHONE=+22890101010          # votre numéro (identifiant de connexion)
ADMIN_PASSWORD=AgbeAdmin@2026     # provisoire — changement forcé à la 1re connexion
ADMIN_FIRST_NAME=Prénom
ADMIN_LAST_NAME=AGBE
```

### 3.3 Construire et démarrer

```bash
docker compose up -d --build
docker compose logs -f app        # suivre le premier démarrage (Ctrl-C pour sortir)
```

Au premier démarrage, l'entrypoint :
1. initialise la base SQLite (schéma vierge) dans le volume `agbe_db` ;
2. active le **mode WAL** (lectures concurrentes non bloquées par les écritures —
   indispensable pour les pics de consultations de plusieurs dizaines de membres) ;
3. crée le registre racine et le compte **Admin Général** avec les valeurs du `.env` ;
4. démarre le serveur sur `127.0.0.1:3000`.

Vérification : `curl http://127.0.0.1:3000/api` doit répondre `{"message":"Hello, world!"}`.

### 3.4 Exposer l'application (Nginx + HTTPS)

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/agbe-family
sudo nano /etc/nginx/sites-available/agbe-family   # remplacer agbe.family par votre domaine
sudo ln -s /etc/nginx/sites-available/agbe-family /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d agbe.family                # certificat Let's Encrypt + renouvellement auto
```

La plateforme est alors accessible sur `https://agbe.family`.

### 3.5 Pare-feu (optionnel mais recommandé)

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

## 4. Exploitation quotidienne

| Action | Commande |
|---|---|
| Journaux de l'application | `docker compose logs -f app` |
| État des conteneurs | `docker compose ps` |
| Redémarrer l'application | `docker compose restart app` |
| Mettre à jour (nouvelle version) | `git pull && docker compose up -d --build` |
| Sauvegarde manuelle de la base | `docker compose exec backup sh -c "sqlite3 /data/db/custom.db \".backup '/backups/agbe-manuel.db'\""` |
| Sauvegardes automatiques | fichiers `./backups/agbe-AAAAMMJJ-HHMMSS.db` (quotidien, 30 jours conservés) + copie hors-site si `BACKUP_REMOTE` est défini |

**Sauvegarde externe — fortement recommandée à 400+ membres** : le serveur ne doit
jamais être la seule copie des données financières de la famille. Le conteneur de
sauvegarde sait pousser chaque export quotidien vers un stockage externe (Backblaze B2
≈ 1–2 €/mois, Hetzner Storage Box, Google Drive…) : copiez le modèle
`deploy/rclone.conf.example` en `deploy/rclone.conf`, renseignez vos clés, puis ajoutez
dans `.env` :

```env
BACKUP_REMOTE="b2:agbe-backups"   # <remote>:<chemin> — même rythme que l'export local
```

La base SQLite contient toutes les données ; le volume `agbe_uploads` contient les
preuves de paiement (`docker compose cp app:/app/uploads ./uploads` — à copier hors
du serveur au moins une fois par mois, par SFTP ou rclone).

**Restauration** :

```bash
docker compose stop app
docker compose run --rm --entrypoint sh app -c \
  "cp /backups/agbe-20260912-023000.db /app/db/custom.db && chown node:node /app/db/custom.db"
docker compose start app
```

## 5. Charger les données de démonstration (optionnel)

Pour tester la plateforme avec le jeu de démonstration (registres, membres, campagnes)
avant la mise en service réelle, depuis une machine de développement :

```bash
bun install && bunx prisma generate
DATABASE_URL="file:/chemin/vers/copie.db" bunx tsx scripts/seed.ts
# puis déposer la copie.db sur le serveur et la placer dans le volume agbe_db
```

Les comptes de démonstration figurent dans le *Guide d'utilisation* (PDF, chapitre 03).
Ils doivent être retirés avant l'ouverture aux membres réels.

## 6. Scalabilité et évolution

- **SQLite en mode WAL** (activé automatiquement au démarrage) : les lectures
  concurrentes ne sont plus bloquées par les écritures. À 400 membres, la charge est
  essentiellement constituée de consultations — SQLite encaisse sans difficulté
  plusieurs centaines de lectures simultanées, la base restant légère (dizaines de Mo
  projetées sur plusieurs années).
- **Montée en charge verticale** : le même `docker-compose.yml` fonctionne sur une
  machine plus puissante (8–16 vCPU) — aucun changement de configuration.
- **Réplication applicative** : pour passer derrière un load balancer, dupliquez le
  service `app` et remplacez SQLite par PostgreSQL (une seule source de vérité
  multi-conteneurs) : `prisma/schema.prisma` → `provider = "postgresql"`, puis
  `prisma migrate deploy`. La migration est décrite dans le PDF de plan de déploiement.
- **CDN** : les assets statiques Next.js étant fingerprintés, un CDN (Cloudflare)
  peut être placé devant Nginx sans configuration particulière.

**Déclencheurs objectifs de migration PostgreSQL** (à relever dans les journaux et le
monitoring) : plus de 800 membres actifs, OU plus de 150 sessions simultanées aux pics,
OU latence API > 500 ms aux heures de pointe, OU besoin de plusieurs conteneurs
applicatifs. En deçà, l'architecture actuelle reste la bonne.

## 7. Dépannage rapide

| Symptôme | Cause probable | Correctif |
|---|---|---|
| `curl 127.0.0.1:3000/api` ne répond pas | Conteneur arrêté ou crash | `docker compose logs app` — redémarrer avec `docker compose up -d` |
| 502 via Nginx | Application non joignable en local | Vérifier `docker compose ps` et le healthcheck |
| Erreur Prisma « engine » au démarrage | Image reconstruite sur alpine | Utiliser le `Dockerfile` fourni (runtime Debian) |
| « login refusé » après restauration | Sessions invalidées (attendu) | Se reconnecter ; les sessions expirées sont purgées |
| Page lente / 413 sur upload | `client_max_body_size` trop bas | Vérifier la valeur (12m) dans `deploy/nginx.conf` |
