# État d’avancement — Maison & Courses

Dernière mise à jour : 29 octobre 2026 — version 0.2.0 (schéma v2, données initiales v2).

## Étapes

| Étape | État |
|---|---|
| 1. Fondations : architecture, PWA, stockage local, navigation, sauvegarde | ✅ Terminée |
| 2. Stocks et courses : CRUD, catégories, emplacements, unités, historique, listes, achats, budget | ✅ Terminée |
| 3. Recettes et menus : bibliothèque, portions, calendrier, suggestions, manques, déduction confirmée | ✅ Terminée |
| 4. Profils : personnes, règles, plans réutilisables, portions individuelles, activation | ✅ Terminée |
| 5. Import du plan familial : 8 semaines, 4 listes, prix, 3 profils, règles, vérification | ✅ Terminée (24/24 contrôles) |
| 6. Optimisation et finition : anti-gaspillage, priorités, substitutions, fournitures, tableau de bord, tests, docs | ✅ Terminée pour la v1 |
| 7. Familles, variantes, formats et équivalences ; import des reçus (JSON) ; historique des prix | ✅ Terminée (v0.2.0) |
| Déploiement GitHub Pages | ✅ https://scemofficiel-design.github.io/maison-courses/ (dépôt public https://github.com/scemofficiel-design/maison-courses) |

## Tests exécutés

- **Familles et import des reçus (v0.2.0, 35 tests ajoutés)** — `tests/unit/families.test.ts` et `tests/unit/receipt.test.ts` :
  - import additif (stock existant, stock inconnu, retour jamais retiré, quantité négative refusée, quantité à préciser si la conversion est inconnue) ;
  - détection des doublons (même reçu remis en forme refusé, reçu semblable signalé) ;
  - mise à jour du dernier prix et historique (reçu plus ancien sans écrasement, prix d’un achat coché en magasin) ;
  - regroupement des variantes (stock global par famille, relations équivalent / à confirmer / non) ;
  - conversions fiables (pack de 4 pots, sac de 2 kg, livres, poids pesé ; barquette ↔ grappe refusée sans conversion) ;
  - absence de faux manques (raisins verts pour des rouges, autre marque de la même variante au tableau de bord, stock non compté deux fois, seuil sur les références équivalentes) ;
  - restrictions (raisins secs, yaourt sucré et conserves jamais utilisés ni proposés pour GM) ;
  - pas de double ajout avec une liste (ligne cochée une fois, achat déjà coché non recompté, surplus seul ajouté, variante achetée à la place) ;
  - création de produits et de familles, reconnaissance des noms appris ;
  - migration des données v1 (familles ajoutées sans écraser une fiche modifiée, sauvegarde v1 restaurée) ;
  - validité de l’exemple `examples/recu-exemple.json` et de celui de `IMPORT_FORMAT.md`.
- **Unitaires (Vitest, 60 tests)** — `npm test` : unités et arrondis, stock inconnu/nul, alertes, mise à l’échelle et portions individuelles, regroupement, génération des listes (règle « ne pas racheter si le stock suffit »), budget, restrictions (interdits, cuisson, huile par repas), CRUD produit, achats idempotents et correction, préparation confirmée et non-double déduction, import du plan (8 semaines, 4 listes, budgets exacts), démarrage/désactivation/réactivation du plan, données initiales versionnées et réinitialisation sélective, persistance après réouverture, export/restauration, rejet d’une sauvegarde invalide, 24 contrôles d’importation du PDF.
- **Bout en bout (Playwright, 7 tests)** — `npm run test:e2e` sur la version de production servie sous `/maison-courses/` : manifeste, icônes et portée du service worker sous sous-chemin ; démarrage du plan et persistance après rechargement ; achat en magasin idempotent ; fonctionnement hors ligne (lecture et modification) ; export puis restauration depuis l’interface ; saisie continue au clavier dans les volets (texte et nombres) ; import d’un reçu depuis un fichier (aperçu, ajout au stock, refus du doublon, historique des prix, stock global de la famille).

Correspondance avec la liste demandée : 1 ✅, 2 ✅, 3 ✅, 4 ✅, 5 ✅, 6 ✅, 7 ✅, 8 ✅, 9 ✅, 10 ✅, 11 ✅, 12 ✅, 13 ✅, 14 ✅, 15 ✅, 16 ✅, 17 ✅, 18 ✅, 19 ✅ (serveur local reproduisant le sous-chemin, puis URL réelle : page, manifeste, service worker, icônes et écrans de lancement en 200 ; portée du service worker `/maison-courses/` et cache hors ligne rempli).

Non testé automatiquement : Safari iOS réel (les tests utilisent Chromium avec un gabarit mobile). À vérifier sur l’iPhone : ajout à l’écran d’accueil, écran de lancement, export via la feuille de partage.

## Hypothèses et décisions

- Le PDF ne contient ni inventaire, ni date de début, ni recettes chiffrées : stocks « inconnus », date choisie par l’utilisateur (ramenée au lundi), recettes à quantités indicatives sauf poulet / tilapia / haricots secs (déduits du document). Détail : [docs/IMPORT_PLAN_FAMILIAL.md](docs/IMPORT_PLAN_FAMILIAL.md).
- Les listes P1–P4 du document sont importées telles quelles (quantités et montants) ; le générateur de l’application calcule à partir des recettes et peut donc différer.
- Multiplicateur de féculent 1,5 pour « Nous » (225 g / 150 g) : hypothèse de calcul modifiable, signalée dans le profil.
- Produits « au goût » (huile, épices, condiments, édulcorant) : non comptés dans les besoins ni déduits à la préparation ; ils se réapprovisionnent par leur seuil, comme le recommande le document (« ne rien racheter s’il en reste »).
- Routage par fragment (`#/…`) pour éviter toute erreur 404 sur GitHub Pages.

## Limites connues

- **Import des reçus** :
  - L’application ne lit pas la photo elle-même : le fichier JSON est préparé par ChatGPT (ou un autre assistant), puis vérifié dans l’aperçu. La qualité dépend de la lecture du reçu.
  - Un stock « inconnu » devient « au moins la quantité achetée » ; le stock réel peut être supérieur.
  - Il n’y a pas de bouton « annuler l’import » : chaque ajout se corrige depuis l’historique de la fiche produit (mouvement inverse).
  - Un reçu régénéré avec des quantités ou des prix lus différemment produit une autre empreinte : il est signalé comme « semblable » (même magasin, jour et total) et non bloqué.
- **Familles** :
  - Les familles et règles de remplacement du catalogue sont des choix par défaut, modifiables.
  - Les recettes de démonstration n’exigent aucune variante précise.
  - Les quantités de variantes de formats différents ne s’additionnent que si une conversion est saisie (ex. 1 barquette = 500 g).

- **Scanner de code-barres** : non implémenté (pas d’API gratuite et fiable dans Safari iOS) ; le code-barres peut être saisi et recherché manuellement.
- **Pain complet** et **huile d’olive** : le nombre de tranches par pain et la contenance de la bouteille ne figurent pas dans le document ; tant qu’aucune conversion n’est saisie dans la fiche produit, les tranches des petits-déjeuners ne sont pas comptées (signalé dans le générateur).
- **Version économique** : seuls les montants par période sont importés (le document ne détaille pas les lignes) ; les substitutions économiques sont disponibles sur les lignes concernées.
- **Une seule devise** (CAD) dans l’interface ; le modèle prévoit une devise par liste et par produit.
- **Synchronisation multi-appareils** : non incluse ; la sauvegarde JSON complète (avec version de schéma) sert de base à une future synchronisation.
- **Langue** : français uniquement ; libellés principaux centralisés dans `src/i18n/fr.ts`, une partie des textes reste dans les pages.
- Les dates de péremption ne sont jamais proposées automatiquement ; la conservation suit les indications du fabricant et des autorités sanitaires.

## Prochaines actions possibles

1. Installer sur l’iPhone depuis Safari et faire une première sauvegarde.
2. Saisir l’inventaire initial (Stocks → filtre « Inconnus »), les conversions du pain et de l’huile.
3. Évolutions : synchronisation facultative entre appareils, version anglaise complète, lecture de codes-barres si une solution iOS fiable devient disponible.
