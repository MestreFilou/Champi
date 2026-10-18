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

### Zones favorables

Quand on choisit une forêt, [server/lib/zones.js](server/lib/zones.js) récupère tous ses peuplements
BD Forêt et ne garde que ceux dont l'essence convient à l'espèce, en trois niveaux selon l'affinité
(`hosts` de l'espèce). La météo étant la même à l'échelle d'un massif, ce sont les arbres qui font la
différence d'un secteur à l'autre. Emprise limitée à ~44 km de côté.

### Suivi GPS

Trace de la sortie, distance et cap pour revenir au point de départ, coins marqués, export GPX
(trace + coins en waypoints). Voir [web/src/useTracker.js](web/src/useTracker.js).

⚠️ Les fiches aident à reconnaître mais ne remplacent jamais la vérification par un pharmacien ou une
association mycologique.
