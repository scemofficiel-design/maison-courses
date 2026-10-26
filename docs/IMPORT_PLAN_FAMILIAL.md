# Rapport d’importation — Plan_alimentaire_familial_8_semaines.pdf

Rapport généré automatiquement par `scripts/import-report.ts` à partir des contrôles de `src/seed/verify.ts` (également exécutés par les tests unitaires et affichés dans Paramètres).

## Contrôles

| Contrôle | Résultat | Détail |
|---|---|---|
| Huit semaines de menus | ✅ | 8 semaines |
| Déjeuners et dîners (8 × 7 × 2) | ✅ | 112 repas |
| Petits-déjeuners (8 × 7) | ✅ | 56 petits-déjeuners |
| Collations de 10 h et 16 h | ✅ | 112 collations |
| Libellés des menus identiques au document | ✅ | Tous les libellés sont repris tels quels |
| Quatre périodes de courses (P1 à P4) | ✅ | 4 périodes, 4 listes |
| Budget P1 = 483.86 $ | ✅ | Somme des lignes : 483.86 $ (52 lignes) |
| Budget P2 = 461.12 $ | ✅ | Somme des lignes : 461.12 $ (43 lignes) |
| Budget P3 = 464.87 $ | ✅ | Somme des lignes : 464.87 $ (47 lignes) |
| Budget P4 = 457.11 $ | ✅ | Somme des lignes : 457.11 $ (42 lignes) |
| Sous-totaux par catégorie conformes au document | ✅ | 7 catégories × 4 périodes |
| Total cible 8 semaines = 1866.96 $ | ✅ | 1866.96 $ |
| Version économique = 1689.18 $ | ✅ | Somme P1–P4 : 1689.18 $ |
| Optionnels P1 = 40,52 $ | ✅ | 40.52 $ |
| Optionnels 8 semaines = 120,08 $ | ✅ | 120.08 $ |
| Moyenne par période = 466,74 $ | ✅ | 466.740 $ |
| Économie de la version économique = 177,78 $ | ✅ | 177.78 $ |
| Unités, quantités et catégories des lignes | ✅ | 184 lignes valides |
| Chaque produit du document est relié au catalogue | ✅ | 53 produits |
| Chaque élément des menus est relié à une recette | ✅ | Tous les éléments sont reliés |
| Recettes et ingrédients existants | ✅ | OK |
| Ingrédients des menus présents dans les listes du document | ✅ | Tous présents |
| Règles de GM importées | ✅ | 38 règles dont 15 « à éviter », 4 règles de portion |
| Aucun repas du plan n’enfreint les règles de GM | ✅ | 280 repas contrôlés |

## Ce qui a été importé

- **Menus** : 8 semaines × 7 jours × (midi + soir), libellés repris à l’identique ; petit-déjeuner hebdomadaire (4 formules) ; collations de 10 h et 16 h.
- **Courses** : 53 produits, 4 listes (P1 à P4) avec quantités, priorités E/O, prix et montants du document (184 lignes au total).
- **Budgets** : cible P1 483,86 $, P2 461,12 $, P3 464,87 $, P4 457,11 $ (total 1 866,96 $) ; version économique 429,10 / 421,99 / 423,35 / 414,74 $ (total 1 689,18 $).
- **Profils** : Grand-mère (règles et portions de la prescription), « Nous » (ma mère et moi), « Moi » (2e œuf) ; aucun nom, âge, poids ou diagnostic ajouté.
- **Principes** : méthode des repas communs, cuisiner moins souvent, anti-gaspillage par semaine, garde-manger, leviers d’économie, hypothèses, points à confirmer au diététicien.

## Correspondance éléments de menu → recettes

| Élément du menu | Recette |
|---|---|
| riz | Riz blanc à l’eau |
| attiéké | Attiéké réchauffé à la vapeur |
| foutou banane | Foutou banane (plantain) |
| foutou igname | Foutou igname |
| igname | Igname bouillie |
| igname bouillie | Igname bouillie |
| plantain bouilli | Plantain bouilli |
| plantain | Plantain bouilli |
| spaghetti | Spaghetti |
| pommes de terre | Pommes de terre à l’eau |
| sauce claire | Sauce claire |
| sauce tomate | Sauce tomate |
| sauce gombo | Sauce gombo |
| sauce tomate-aubergine | Sauce tomate-aubergine |
| sauce aubergine-tomate | Sauce tomate-aubergine |
| sauce feuilles | Sauce feuilles |
| sauce légumes | Sauce légumes |
| sauce épinards | Sauce épinards |
| tilapia au four | Tilapia au four |
| tilapia braisé | Tilapia braisé |
| tilapia | Tilapia (cuit dans la sauce) |
| tilapia papillote | Tilapia en papillote |
| poulet au four | Poulet au four (sans peau) |
| poulet braisé | Poulet braisé (sans peau) |
| poulet | Poulet sans peau (cuit dans la sauce ou à l’eau) |
| œufs durs | Œufs durs |
| 2 œufs durs | Œufs durs |
| omelette sans huile | Omelette sans huile |
| haricots secs | Haricots secs cuits sans sel |
| salade composée | Salade composée |
| tomate-concombre | Salade tomate-concombre |
| salade tomate-concombre | Salade tomate-concombre |
| carottes râpées | Carottes râpées |
| brocoli | Brocoli vapeur |
| salade | Salade verte |
| haricots verts | Haricots verts vapeur |
| courgettes-poivron vapeur | Courgettes-poivron vapeur |
| poivrons-courgettes vapeur | Courgettes-poivron vapeur |
| légumes vapeur | Légumes vapeur |
| carottes | Carottes vapeur |
| courgettes vapeur | Courgettes vapeur |
| courgettes | Courgettes vapeur |
| courgettes-aubergine | Courgettes-aubergine vapeur |
| aubergines au four | Aubergines au four |
| aubergine-tomate au four | Aubergine-tomate au four |
| tomates | Tomates en salade |

## Interprétations, ambiguïtés et données non importées

- Le document ne contient pas d’inventaire : tous les produits démarrent avec une quantité « inconnue » (et non nulle).
- Le document ne donne pas de date de début : le calendrier est créé quand vous choisissez la date de démarrage du plan.
- Le document ne contient pas de recettes chiffrées par plat : les quantités des recettes sont indicatives, sauf le poulet (800 g cru pour 3 portions), le tilapia (540 g par repas, déduit de 5,4 kg pour 10 repas) et les haricots secs (250 g par repas, déduit de 0,5 kg pour 2 repas).
- Les quantités des listes P1 à P4 et leurs montants sont repris tels quels du document ; une liste générée par l’application à partir des menus peut différer.
- Le détail ligne par ligne de la version économique n’est pas fourni : seuls les montants par période (429,10 / 421,99 / 423,35 / 414,74 $) sont importés comme budgets.
- Interprétations : « foutou banane » = banane plantain ; « sauce feuilles » = épinards ; « tilapia » et « poulet » sans mode de cuisson = cuits dans la sauce ou à l’eau ; « tomates » = tomates en salade ; « 2 œufs durs » et « œufs durs » = même recette.
- Pain complet : le nombre de tranches par pain n’est pas indiqué ; renseignez-le dans la fiche produit pour que les petits-déjeuners soient comptés.
- Huile d’olive : la contenance de la bouteille n’est pas indiquée ; l’huile est traitée comme produit de garde-manger (réapprovisionnement par seuil).

Les points « à faire confirmer au diététicien » du document sont conservés tels quels dans les règles du profil de Grand-mère (type « à confirmer »).
