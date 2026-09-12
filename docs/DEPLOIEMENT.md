# Déploiement AGBE Family — Guide pas-à-pas

Ce document décrit la mise en production de la plateforme **AGBE Family (PGF)** selon
deux voies : la voie principale (§ 2 à 7) sur un **serveur dédié (VPS)** avec Docker,
Nginx et HTTPS ; la voie alternative (§ 8) sur un **PaaS** (Railway ou Render) pour une
équipe qui ne veut administrer aucun serveur. Le plan d'architecture et la comparaison
détaillée des hébergeurs figurent dans le document *Plan de déploiement AGBE Family*
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
| `docker/entrypoint.sh` | Initialisation de la base + amorçage admin + boucle de sauvegarde intégrée (PaaS, § 8) |
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

## 8. Alternative PaaS — Railway ou Render (sans serveur à administrer)

Cette section s'adresse aux familles qui ne disposent d'aucune ressource d'administration
système. Les deux plateformes construisent et hébergent l'application à partir du dépôt
GitHub (`git push` = mise en production), génèrent l'HTTPS automatiquement et proposent
journaux, métriques et retour arrière en un clic. Le `Dockerfile` du dépôt est utilisé
tel quel — **aucun fichier à modifier**.

### 8.1 Pourquoi Railway et Render conviennent (et pas Vercel)

L'application repose sur **SQLite** (fichier unique) : la plateforme doit offrir un
stockage **persistant** et un conteneur **toujours actif**. C'est exactement ce que ces
deux PaaS proposent — et ce qui manque à Vercel (système de fichiers éphémère + démarrages
à froid) :

| | Vercel | Railway | Render (payant) | VPS Hetzner CX32 |
|---|---|---|---|---|
| SQLite persistant | non — FS éphémère | oui (volume) | oui (disque) | oui (volume Docker) |
| Conteneur toujours actif | non (fonctions) | oui | oui | oui |
| Réveil à froid | 0,5–2 s | aucun | aucun | aucun |
| RAM au tarif d'entrée | — | ~0,5–1 Go à l'usage | 512 Mo (Starter) | **8 Go** |
| Coût mensuel indicatif | 20 $ (Pro requis) | 5–15 $ | 7–25 $ | ≈ 9 € |
| Administration système | aucune | aucune | aucune | à votre charge |
| Sauvegarde quotidienne | — | boucle intégrée (§ 8.5) | boucle intégrée (§ 8.5) | conteneur dédié |
| Postgres managé (avenir) | Neon/Turso | oui | oui | auto-hébergé |

> Tarifs indicatifs à la rédaction de ce guide — vérifiez les grilles au moment de
> souscrire. Choisir de préférence la **région Francfort** sur les deux plateformes
> (latence Lomé comparable à celle d'un VPS européen).

### 8.2 Variables d'environnement (identiques sur les deux plateformes)

À définir **avant le premier démarrage** (l'amorçage du compte Admin Général se fait
une seule fois, au premier lancement) :

| Variable | Valeur d'exemple | Rôle |
|---|---|---|
| `ADMIN_PHONE` | `+22890101010` | identifiant de connexion du Admin Général |
| `ADMIN_PASSWORD` | `AgbeAdmin@2026` | provisoire — changement forcé à la 1re connexion |
| `ADMIN_FIRST_NAME` / `ADMIN_LAST_NAME` | `Prénom` / `NOM` | affichage du compte |
| `TZ` | `Africa/Lome` | horodatage des sauvegardes et journaux |
| `BACKUP_REMOTE` | `b2:agbe-backups` | active la sauvegarde quotidienne intégrée (§ 8.5) |
| `RCLONE_CONFIG_B2_*` | cf. § 8.5 | configuration rclone par variables d'environnement |

### 8.3 Déploiement sur Railway — pas à pas

1. Créez un compte sur `railway.app` et souscrivez le plan **Hobby** (~5 $/mois,
   consommation déduite ; il n'existe pas de palier gratuit permanent).
2. **New Project → Deploy from GitHub repo** → autorisez Railway à accéder au dépôt
   `ErdisKodjo/agbe-family`. Le `Dockerfile` est détecté et utilisé automatiquement.
3. Choisissez la région **EU West (Francfort)** lors de la création du projet.
4. Avant le premier démarrage, définissez les variables du § 8.2 (service →
   *Variables*).
5. Créez **deux volumes** (service → *Settings → Volumes*) : l'un monté sur
   `/app/db` (base SQLite — critique), l'autre sur `/app/uploads` (preuves de
   paiement). Les données survivent aux redéploiements.
6. *Settings → Networking → Generate Domain* : l'application est publiée en HTTPS sur
   `xxx.up.railway.app`. Un domaine personnalisé se pose par enregistrement CNAME
   (certificat géré par Railway).
7. Premier démarrage : l'entrypoint initialise la base, amorce l'admin (mode WAL
   activé), démarre le serveur. Vérifiez `https://xxx.up.railway.app/api`.
8. Ajustez les limites du service (*Settings → Resources*) : **1 Go de RAM
   recommandé pour 400+ membres** (la facturation suit l'usage réel).
9. Shell d'accès : `railway ssh` (CLI) — l'image embarque `sqlite3` et `rclone`
   pour inspecter la base ou déclencher une sauvegarde manuelle.
10. Chaque `git push` sur `main` redéploie automatiquement (avec construction de
    l'image et healthcheck).

### 8.4 Déploiement sur Render — pas à pas

1. Créez un compte sur `render.com` → **New → Web Service** → connectez le dépôt
   GitHub `ErdisKodjo/agbe-family`. Le runtime **Docker** (notre `Dockerfile`) est
   détecté automatiquement.
2. **⚠️ Prenez le plan Starter (7 $/mois) au minimum.** Le plan gratuit est à
   proscrire absolument : le service s'endort après 15 min d'inactivité (première
   connexion pénalisée d'environ une minute — l'anti-fluidité) et **n'offre pas de
   disque persistant** : la base serait effacée à chaque mise en veille. Starter
   (512 Mo) suffit pour démarrer ; Standard (2 Go) est confortable pour les pics
   d'annonces.
3. Région : **Frankfurt**.
4. Ajoutez **deux disques persistants** (service → *Disks*) : `/app/db` (1 Go mini)
   et `/app/uploads` (1 Go mini). Un disque est lié au service : ne modifiez jamais
   le chemin de montage et ne supprimez pas le service sans sauvegarde préalable.
5. Renseignez les variables du § 8.2 (service → *Environment*).
6. La construction de l'image s'exécute sur un builder **sans** disque attaché :
   c'est prévu — toute l'initialisation de la base se fait dans l'entrypoint, **au
   démarrage** (la base vierge `pristine.db` est embarquée dans l'image).
7. L'application est publiée en HTTPS sur `xxx.onrender.com` ; domaine personnalisé
   par CNAME. Le healthcheck Docker (`/api`) est repris par la plateforme.
8. Shell : onglet *Shell* du tableau de bord (instances payantes).
9. Option : un *Cron Job* Render peut relancer la sauvegarde à heure fixe — la boucle
   intégrée (§ 8.5) rend cela inutile en pratique.

### 8.5 Sauvegardes et restauration sur PaaS

Sur VPS, le conteneur dédié `backup` (docker-compose) fait le travail. Sur PaaS, ce
conteneur n'existe pas : l'entrypoint embarque une **boucle de sauvegarde intégrée**,
activée dès que `BACKUP_REMOTE` est défini. Chaque jour : export SQLite sûr
(`.backup`, lectures non bloquées), copie sur le volume (`/app/db/backups`, rétention
7 j) puis **copie hors-site** via rclone (rétention 30 j).

La configuration rclone se fait **par variables d'environnement** (aucun fichier à
monter). Exemple avec Backblaze B2 (~1 $/mois pour des années de sauvegardes) :

```env
BACKUP_REMOTE=b2:agbe-backups
RCLONE_CONFIG_B2_TYPE=b2
RCLONE_CONFIG_B2_ACCOUNT=<votre keyID B2>
RCLONE_CONFIG_B2_KEY=<votre application key B2>
```

Tout remote rclone fonctionne sur le même principe (S3, Google Drive, OneDrive…) :
préfixez les options par `RCLONE_CONFIG_<NOM>_`. **N'attendez pas des snapshots de
plateforme une sauvegarde quotidienne programmée — la boucle intégrée est la garantie
réelle.** À 400+ membres, ne l'activez pas « plus tard » : faites-le au premier jour.

Restauration (depuis le shell de la plateforme) :

```bash
rclone copy b2:agbe-backups/agbe-AAAAMMJJ-HHMMSS.db /tmp/
sqlite3 /app/db/custom.db ".restore '/tmp/agbe-AAAAMMJJ-HHMMSS.db'"
# puis redémarrer le service (les sessions ouvertes expirent — c'est attendu)
```

### 8.6 Ce qu'il faut savoir avant de choisir

- **Puissance par euro** : au prix d'un Render Starter (7 $, 512 Mo), le VPS CX32
  (≈ 9 €) offre 8 Go de RAM dédiée et 4 vCPU — ~16× plus de mémoire. À 400+ membres
  et lors des pics d'annonces, cette marge se ressent en fluidité. Le VPS reste la
  recommandation principale (§ 2–7) lorsque quelqu'un peut l'administrer.
- **Ce que le PaaS vous achète** : zéro Nginx, zéro certificat à renouveler, zéro
  mise à jour OS, veille de sécurité déléguée, déploiement en un `git push`,
  journaux et retour arrière en un clic. C'est un choix parfaitement défendable pour
  une équipe sans compétence système.
- **Ce que le PaaS vous ôte** : la limitation de débit Nginx sur
  `/api/auth/login` (5 r/s) n'existe plus — les plateformes fournissent des
  protections réseau de base et l'application conserve scrypt + changement de
  mot de passe forcé ; les sauvegardes dépendent de la boucle rclone (§ 8.5) et non
  plus du conteneur dédié.
- **Localisation des données** : infrastructure européenne si vous choisissez
  Francfort, mais données hébergées chez un opérateur américain dans les deux cas.
- **Trajectoire PostgreSQL** : les deux plateformes proposent un Postgres managé
  (~7 $/mois) — la migration décrite au § 6 reste applicable si les déclencheurs
  objectifs sont un jour atteints.
