# État d’avancement — Maison & Courses

Dernière mise à jour : 26 octobre 2026 — version 0.1.0 (schéma v1, données initiales v1).

## Étapes

| Étape | État |
|---|---|
| 1. Fondations : architecture, PWA, stockage local, navigation, sauvegarde | ✅ Terminée |
| 2. Stocks et courses : CRUD, catégories, emplacements, unités, historique, listes, achats, budget | ✅ Terminée |
| 3. Recettes et menus : bibliothèque, portions, calendrier, suggestions, manques, déduction confirmée | ✅ Terminée |
| 4. Profils : personnes, règles, plans réutilisables, portions individuelles, activation | ✅ Terminée |
| 5. Import du plan familial : 8 semaines, 4 listes, prix, 3 profils, règles, vérification | ✅ Terminée (24/24 contrôles) |
| 6. Optimisation et finition : anti-gaspillage, priorités, substitutions, fournitures, tableau de bord, tests, docs | ✅ Terminée pour la v1 |
| Déploiement GitHub Pages | ⏳ Workflow prêt ; publication en attente de l’accord sur la visibilité du dépôt |

## Tests exécutés

- **Unitaires (Vitest, 60 tests)** — `npm test` : unités et arrondis, stock inconnu/nul, alertes, mise à l’échelle et portions individuelles, regroupement, génération des listes (règle « ne pas racheter si le stock suffit »), budget, restrictions (interdits, cuisson, huile par repas), CRUD produit, achats idempotents et correction, préparation confirmée et non-double déduction, import du plan (8 semaines, 4 listes, budgets exacts), démarrage/désactivation/réactivation du plan, données initiales versionnées et réinitialisation sélective, persistance après réouverture, export/restauration, rejet d’une sauvegarde invalide, 24 contrôles d’importation du PDF.
- **Bout en bout (Playwright, 5 tests)** — `npm run test:e2e` sur la version de production servie sous `/maison-courses/` : manifeste, icônes et portée du service worker sous sous-chemin ; démarrage du plan et persistance après rechargement ; achat en magasin idempotent ; fonctionnement hors ligne (lecture et modification) ; export puis restauration depuis l’interface.

Correspondance avec la liste demandée : 1 ✅, 2 ✅, 3 ✅, 4 ✅, 5 ✅, 6 ✅, 7 ✅, 8 ✅, 9 ✅, 10 ✅, 11 ✅, 12 ✅, 13 ✅, 14 ✅, 15 ✅, 16 ✅, 17 ✅, 18 ✅, 19 ✅ (sur un serveur local reproduisant le sous-chemin ; à revérifier sur l’URL GitHub Pages réelle une fois publiée).

Non testé automatiquement : Safari iOS réel (les tests utilisent Chromium avec un gabarit mobile). À vérifier sur l’iPhone : ajout à l’écran d’accueil, écran de lancement, export via la feuille de partage.

## Hypothèses et décisions

- Le PDF ne contient ni inventaire, ni date de début, ni recettes chiffrées : stocks « inconnus », date choisie par l’utilisateur (ramenée au lundi), recettes à quantités indicatives sauf poulet / tilapia / haricots secs (déduits du document). Détail : [docs/IMPORT_PLAN_FAMILIAL.md](docs/IMPORT_PLAN_FAMILIAL.md).
- Les listes P1–P4 du document sont importées telles quelles (quantités et montants) ; le générateur de l’application calcule à partir des recettes et peut donc différer.
- Multiplicateur de féculent 1,5 pour « Nous » (225 g / 150 g) : hypothèse de calcul modifiable, signalée dans le profil.
- Produits « au goût » (huile, épices, condiments, édulcorant) : non comptés dans les besoins ni déduits à la préparation ; ils se réapprovisionnent par leur seuil, comme le recommande le document (« ne rien racheter s’il en reste »).
- Routage par fragment (`#/…`) pour éviter toute erreur 404 sur GitHub Pages.

## Limites connues

- **Scanner de code-barres** : non implémenté (pas d’API gratuite et fiable dans Safari iOS) ; le code-barres peut être saisi et recherché manuellement.
- **Pain complet** et **huile d’olive** : le nombre de tranches par pain et la contenance de la bouteille ne figurent pas dans le document ; tant qu’aucune conversion n’est saisie dans la fiche produit, les tranches des petits-déjeuners ne sont pas comptées (signalé dans le générateur).
- **Version économique** : seuls les montants par période sont importés (le document ne détaille pas les lignes) ; les substitutions économiques sont disponibles sur les lignes concernées.
- **Une seule devise** (CAD) dans l’interface ; le modèle prévoit une devise par liste et par produit.
- **Synchronisation multi-appareils** : non incluse ; la sauvegarde JSON complète (avec version de schéma) sert de base à une future synchronisation.
- **Langue** : français uniquement ; libellés principaux centralisés dans `src/i18n/fr.ts`, une partie des textes reste dans les pages.
- Les dates de péremption ne sont jamais proposées automatiquement ; la conservation suit les indications du fabricant et des autorités sanitaires.

## Prochaines actions possibles

1. Publier sur GitHub Pages (dépôt et visibilité à confirmer), puis vérifier l’URL réelle et l’installation sur iPhone.
2. Saisir l’inventaire initial (Stocks → filtre « Inconnus »), les conversions du pain et de l’huile.
3. Évolutions : synchronisation facultative entre appareils, version anglaise complète, lecture de codes-barres si une solution iOS fiable devient disponible.
