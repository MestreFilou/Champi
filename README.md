# Champi 🍄

Appli web pour savoir **où et quand** aller aux champignons en France : carte des forêts avec leurs essences,
score de pousse par espèce à partir de la météo réelle, fiches d'identification et observations récentes.

## Lancer

```bash
npm install
npm run dev      # API sur :3001 + front Vite sur http://localhost:5173
npm test         # tests du modèle de score
npm run build && npm start   # version de production sur http://localhost:3001
npm run dev:mobile           # idem en HTTPS sur le réseau local, pour le téléphone
```

### En ligne sur Vercel

Le projet est prêt pour Vercel : l'interface est servie en fichiers statiques (`dist/`) et toute l'API Express
tourne dans une seule fonction serverless ([api/index.js](api/index.js), réglages dans [vercel.json](vercel.json)).

```bash
npx vercel login     # une fois, ouvre le navigateur
npx vercel           # déploiement de test (URL de prévisualisation)
npx vercel --prod    # mise en production
```

Ou depuis GitHub : pousser le dépôt puis l'importer sur vercel.com, sans rien régler (vercel.json suffit).
Vercel fournit le HTTPS, donc le GPS marche directement sur le téléphone : ouvrir l'adresse puis
« Ajouter à l'écran d'accueil ».

**Mot de passe** : dans Vercel, *Settings → Environment Variables*, ajouter `APP_PASSWORD` puis redéployer.
[middleware.js](middleware.js) protège alors tout le site (pages et API) derrière [login.html](web/public/login.html) ;
la connexion reste mémorisée un an par appareil, et changer le mot de passe déconnecte tout le monde.
Sans cette variable, l'appli reste ouverte. En local (`npm run dev`), pas de mot de passe.

Le cache mémoire ne vit que le temps d'une instance de fonction : après une période sans visite, les
premières requêtes repassent par l'IGN et Open-Meteo et sont un peu plus lentes.

### Sur le téléphone, sans hébergement

Le navigateur ne donne accès au GPS qu'en HTTPS. Avec `npm run dev:mobile`, Vite affiche une adresse
`https://192.168.x.x:5173` : ouvre-la depuis le téléphone (même Wi-Fi), accepte l'avertissement du
certificat auto-signé, puis autorise la localisation.

Le suivi ne marche que tant que l'appli est à l'écran : un navigateur coupe le GPS quand l'écran se
verrouille ou qu'on change d'appli. Pendant une sortie, l'appli demande à garder l'écran allumé.
La trace en cours et les coins marqués restent dans le navigateur (localStorage) ; une sortie interrompue
par un rechargement repart en pause.

Aucune clé d'API n'est nécessaire.

## Sources de données

| Besoin | Source |
| --- | --- |
| Essences d'arbres | IGN BD Forêt V2 (WFS pour l'analyse, WMS pour la carte) |
| Recherche de forêts | IGN BD TOPO « forêt publique » + Nominatim (OpenStreetMap) |
| Fonds de carte | Plan IGN, photos aériennes IGN, OpenStreetMap |
| Météo | Open-Meteo : 45 jours d'historique + 14 jours de prévision, humidité du sol |
| Zones favorables | IGN BD Forêt V2 (WFS) : peuplements filtrés selon les arbres hôtes de l'espèce |
| Pente et exposition | IGN, service d'altimétrie (RGE ALTI) |
| Type de sol | BRGM, carte lithologique simplifiée au 1/1 000 000 |
| Parkings | OpenStreetMap via Overpass (lent : chargé à part) |
| Observations et commentaires | iNaturalist (API publique) |
| Photos des fiches | iNaturalist (licences Creative Commons, attribution affichée) |

## Le score (0–100)

Calculé dans [server/lib/score.js](server/lib/score.js) avec les paramètres de chaque espèce de
[server/data/species.js](server/data/species.js) :

- **pluie déclenchante** : cumul dans la fenêtre propre à l'espèce (ex. cèpe : 7 à 16 jours avant) ;
- **humidité actuelle** : sol 0–7 cm, humidité de l'air, pluie des 5 derniers jours ;
- **température** moyenne de la semaine comparée à la plage idéale de l'espèce ;
- pénalités de **gel** (selon la tolérance de l'espèce) et de **sécheresse** ;
- **saison** ;
- **arbres hôtes** : part du disque d'analyse couverte par des essences favorables (BD Forêt).

C'est une heuristique pour classer jours et secteurs, à affiner avec l'expérience du terrain.

### Prévisions et fiabilité

Le score est calculé pour chacun des 14 jours à venir. Sa fiabilité (`forecastConfidence` dans
[server/lib/score.js](server/lib/score.js)) dépend de l'échéance et de la part de la fenêtre de pluie
déclenchante déjà tombée : pour le cèpe, le score de J+5 repose surtout sur de la pluie mesurée.
Le « meilleur jour » pondère le score par cette fiabilité, pour qu'un jour lointain incertain ne
l'emporte pas sur un bon jour proche.

### Zones : toutes les espèces d'un coup

Quand on choisit une forêt, [server/lib/zones.js](server/lib/zones.js) récupère tous ses peuplements BD Forêt
et donne à chacun une note par espèce, sur 100 : la note météo du jour de l'espèce (la même sur tout le massif)
× l'adéquation du peuplement (arbres hôtes, ajustés par le versant et par le sol).

- **Toutes les espèces** (par défaut) : une seule teinte, plus foncée là où la meilleure note est haute ;
  la liste donne, pour chaque espèce, la note atteinte sur au moins 10 ha de la forêt (une seule petite
  clairière ne suffit pas), la part de la forêt qui lui convient et son meilleur jour à venir.
- **Une espèce** : ses trois niveaux (60 et plus, 35 à 59, 10 à 34), sa fiche et ses prévisions.
- **Plusieurs espèces** (5 au plus) : chaque parcelle prend la couleur de l'espèce pour qui c'est l'un de ses
  meilleurs coins (note rapportée à sa meilleure note dans la forêt), gris quand elles sont à égalité.

Les espèces se choisissent avec les pastilles sous la recherche ou en cochant la liste.

### Mes forêts et retour arrière

« ☆ Enregistrer dans Mes forêts » garde le secteur en cours (forêt, point, rayon, espèces) ; l'onglet
**Forêts** les liste avec ce qui pousse aujourd'hui et les rouvre d'un geste. Chaque changement d'onglet,
de secteur, de rayon ou d'espèces est une étape d'historique : la flèche ← et le bouton retour du téléphone
y reviennent.

Le relief ajuste les notes : pente et exposition au centre de chaque peuplement ([server/lib/relief.js](server/lib/relief.js)).
Par temps chaud ou sec, les versants nord gagnent jusqu'à 30 % d'adéquation ; par temps froid, les versants sud.
Emprise limitée à ~44 km de côté et 2000 peuplements (les mieux notés).

### Sol

Le type de roche sous le point (calcaire, acide, neutre) est comparé au sol préféré de l'espèce (`soil` dans
[species.js](server/data/species.js)) : 0,55 en cas de désaccord, 0,8 sur sol neutre. L'échelle de la carte
(1/1 000 000) en fait une indication régionale, d'où une pénalité plutôt qu'une exclusion.

### Carnet

Coins marqués en sortie, avec leurs récoltes (espèce, quantité, note, photo réduite à 1280 px), un tableau
« mes saisons » par espèce et par mois, et une sauvegarde JSON (photos comprises) pour changer de téléphone.
Données sur l'appareil : localStorage pour les coins, IndexedDB pour les photos.

### Hors ligne

Un service worker ([web/public/sw.js](web/public/sw.js), actif en production seulement) garde l'appli, les
réponses de l'API (servies depuis le cache si le réseau met plus de 6 s) et les tuiles de carte. « Enregistrer
la zone affichée » télécharge le Plan IGN du secteur jusqu'au zoom le plus fin qui tient en 2500 tuiles :
plus on zoome avant d'enregistrer, plus la carte hors ligne est détaillée. La dernière vue est mémorisée,
pour qu'un rechargement sans réseau retrouve le même secteur.

### Suivi GPS

Trace de la sortie, boussole vers le point de départ ou vers un coin du carnet (flèche orientée avec la
boussole du téléphone, nord en haut sinon), coins marqués, export GPX (trace + coins en waypoints). Voir [web/src/useTracker.js](web/src/useTracker.js).

⚠️ Les fiches aident à reconnaître mais ne remplacent jamais la vérification par un pharmacien ou une
association mycologique.
