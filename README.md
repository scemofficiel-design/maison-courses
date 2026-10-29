# Maison & Courses

Application familiale **local-first** pour iPhone et ordinateur : stocks de la maison, listes de courses intelligentes, menus, recettes, profils alimentaires et budget. Elle s’installe sur l’écran d’accueil depuis Safari (PWA), fonctionne hors ligne et ne demande ni compte ni abonnement.

Elle est livrée préconfigurée avec le **« Plan familial — 8 semaines avec grand-mère »**, importé du document `Plan_alimentaire_familial_8_semaines.pdf` (voir [docs/IMPORT_PLAN_FAMILIAL.md](docs/IMPORT_PLAN_FAMILIAL.md)).

## Utilisation sur iPhone

1. Ouvrez l’adresse du site dans **Safari**.
2. Touchez **Partager** (carré avec une flèche vers le haut), puis **Sur l’écran d’accueil** → **Ajouter**.
3. Lancez toujours l’application depuis cette icône : sur iPhone, l’application installée et Safari ont des données séparées.
4. Au premier lancement, choisissez la date de début du plan familial (un lundi) sur l’accueil, puis indiquez vos quantités dans **Stocks** (le document ne contenant pas d’inventaire, tous les produits démarrent en « quantité inconnue »).

## Sauvegarde : à faire régulièrement

Les données sont stockées **uniquement sur l’appareil** (IndexedDB). Ce n’est pas une sauvegarde garantie : Safari peut effacer les données d’un site peu utilisé, et elles disparaissent si l’icône est supprimée.

- **Sauvegarder** : Plus → Paramètres → *Exporter toutes les données*. Sur iPhone, la feuille de partage permet d’enregistrer le fichier `.json` dans Fichiers / iCloud Drive, ou de l’envoyer par AirDrop ou courriel.
- **Restaurer** (nouvel appareil, réinstallation) : Paramètres → *Restaurer une sauvegarde* → choisir le fichier. Toutes les données de l’appareil sont remplacées par celles de la sauvegarde (après confirmation).
- Un rappel s’affiche si aucune sauvegarde n’a été exportée depuis 7 jours (réglable).

## Fonctionnalités

- **Accueil** : repas du jour, manques et ajout direct aux courses, indicateurs de stock, prochaine liste et budget, produits à consommer en priorité, préparations groupées, repas réalisables, personnes à table. Indicateurs personnalisables.
- **Familles et variantes** : chaque produit peut appartenir à une famille (Raisins, Yaourts, Riz, Papier toilette…) avec sa variante, sa marque et son format d’achat (grappe, barquette, pack, sac 2 kg…). Stock global de la famille et détail des variantes. Règle de remplacement par famille : *interchangeables* (raisins verts ou rouges), *à confirmer* (yaourt nature ou aux fruits : proposé, jamais compté d’office), *non* (tomates fraîches ou en conserve). Une même variante d’une autre marque ou d’un autre format est toujours équivalente ; une variante interdite par un profil n’est jamais utilisée ni proposée ; une recette peut exiger une variante précise.
- **Import des reçus** : fichier JSON généré par ChatGPT à partir d’une photo du reçu (format décrit dans [IMPORT_FORMAT.md](IMPORT_FORMAT.md), consignes copiables depuis l’application avec la liste de vos produits). L’aperçu permet de vérifier chaque correspondance avant validation. L’import ajoute seulement les quantités achetées (jamais de remplacement ni de diminution), crée les produits nouveaux dans la bonne famille, met à jour le dernier prix payé et l’historique des prix, refuse un reçu déjà importé et, associé à une liste de courses, coche les articles sans compter deux fois un achat déjà coché.
- **Stocks** : produits alimentaires et ménagers, catégories et emplacements personnalisables, quantité inconnue ≠ quantité nulle, boutons rapides (+1, −1, +100 g…), « tout épuisé », périmé/jeté, déplacement, historique complet avec correction, seuils et quantités cibles, péremption (jamais devinée), conversions d’unités (1 paquet = 300 g), prévision de consommation indicative.
- **Courses** : listes multiples (budget, date, magasin, statut), génération à partir des menus d’une période et des stocks (références équivalentes de la même famille comprises), regroupement des doublons, arrondi aux formats de vente, explication de chaque article, achat en magasin à une main (quantité et prix réels, mise à jour du stock idempotente, annulation), indisponible, substitution, articles imprévus, retrait des facultatifs si le budget est dépassé.
- **Budget** : prévu, estimé, dépensé, écart, coût hebdomadaire et par personne, comparaison des périodes, historique des dépenses, budgets de référence du plan.
- **Menus** : vue jour et semaine, 5 créneaux, ajout, modification, déplacement, remplacement, duplication de semaine, génération des créneaux libres (stocks, priorités, coût, variété) avec confirmation, ingrédients manquants de la semaine.
- **Repas** : portions individuelles par personne (plat commun + adaptations), contrôle des restrictions, ingrédients nécessaires et disponibilité, confirmation de préparation avec quantités modifiables (déduction du stock une seule fois, annulable).
- **Recettes** : bibliothèque de 45 recettes (africaines et internationales), calculateur de portions (assaisonnements non linéaires et ajustables), coût estimé, compatibilité par profil, adaptations individuelles, création et modification.
- **Que cuisiner ?** : suggestions selon les stocks réels (disponible, manquant, quantité manquante, surcoût, temps, profils compatibles) avec filtres ; un repas qui enfreint une restriction active n’est jamais proposé.
- **Profils** : personnes, profils alimentaires (règles stockées dans les données, modifiables, avertissement pour les règles de prescription), plans alimentaires réutilisables et duplicables, périodes, activation/désactivation avec aperçu des effets et sans suppression d’historique.
- **Paramètres** : sauvegarde et restauration, rapport d’importation du PDF, réinitialisation sélective des données de démonstration (sans toucher aux stocks ni à l’historique), catégories et emplacements, préférences.

## Architecture

| Couche | Dossier | Rôle |
|---|---|---|
| Domaine | `src/domain/` | Logique pure et testée : unités, stocks, familles et équivalences (`families.ts`), lecture des reçus (`receipt.ts`), portions, restrictions, génération des courses, suggestions, menus, anti-gaspillage |
| Persistance | `src/db/` | IndexedDB via Dexie : schéma versionné, opérations transactionnelles et idempotentes, sauvegarde/restauration, données initiales versionnées |
| Données initiales | `src/seed/` | Transcription du PDF (`planDocument.ts`), catalogue, recettes, profils, assemblage versionné et vérification |
| Interface | `src/pages/`, `src/ui/` | React, navigation inférieure sur mobile et latérale sur ordinateur |
| Textes | `src/i18n/fr.ts` | Libellés français, prêts pour une future version anglaise |

**Stack** : React 18, TypeScript, Vite 5, `vite-plugin-pwa` (Workbox), Dexie 4, React Router (routage par fragment `#/…`, compatible avec tout hébergement statique sous sous-chemin), `lucide-react` (icônes). Tests : Vitest + fake-indexeddb, Playwright.

**Idempotence** : chaque mouvement de stock porte une clé unique (`purchase:<ligne>:<n>:stock`, `meal:<repas>:<n>:<produit>`…). Un achat ou une préparation déjà enregistré n’est jamais appliqué deux fois ; une correction crée un mouvement inverse au lieu de réécrire l’historique.

**Familles et équivalences** : un besoin porte toujours sur la variante demandée par la recette. `allocateStock` répartit le stock entre les besoins : le produit lui-même d’abord, puis les références équivalentes autorisées pour les personnes qui mangent le plat (celles qui expirent le plus tôt d’abord), sans compter deux fois le même stock. Les mêmes calculs servent aux courses, aux suggestions, aux manques du tableau de bord, à la page repas et à la déduction après préparation (la variante réellement utilisée est déduite). Aucune conversion n’est faite sans quantité connue.

**Données initiales versionnées** : chaque donnée de démonstration porte un `seedKey`. Une nouvelle version (`SEED_VERSION`) ajoute les nouveautés sans écraser ce que l’utilisateur a modifié ou supprimé, et ne touche jamais aux quantités en stock, aux achats ni aux dates du plan.

**IA** : aucune. Tout fonctionne par règles locales. L’architecture (moteurs purs dans `src/domain/`) permettrait d’ajouter plus tard une IA externe facultative, désactivée par défaut, sans envoi de données sans action explicite.

## Développement

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

```bash
npm run build:pages
```

`npm run test:e2e` construit la version de production sous `/maison-courses/` et vérifie : manifeste et icônes sous le sous-chemin, portée du service worker, fonctionnement hors ligne, persistance après rechargement, achat idempotent, export puis restauration depuis l’interface, saisie au clavier, import d’un reçu (aperçu, ajout, refus du doublon, vue par famille).

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` lance les tests puis publie `dist/` sur GitHub Pages à chaque poussée sur `main`, avec le chemin de base `/<nom-du-dépôt>/`. Dans les réglages du dépôt : *Settings → Pages → Source : GitHub Actions*.

## Limites connues

Voir [PROGRESS.md](PROGRESS.md).
