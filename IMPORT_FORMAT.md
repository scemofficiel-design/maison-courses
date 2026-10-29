# Format d’import des reçus — `maison-courses-recu` version 1

Ce format permet de transmettre à **Maison & Courses** les achats d’un reçu de caisse. Le fichier est généré par un assistant (par exemple ChatGPT) à partir d’une photo du reçu, puis importé dans l’application (**Courses → Reçu**, ou **Stocks → Reçu**).

Exemple complet et valide : [`examples/recu-exemple.json`](examples/recu-exemple.json).

## Mode d’emploi sur iPhone

1. Dans l’application, ouvrez **Importer un reçu**, puis touchez **Consignes pour ChatGPT** et **Copier les consignes**. Le texte copié contient ce format et la liste de vos produits, avec leurs identifiants.
2. Dans ChatGPT, collez les consignes et joignez la photo du reçu dans le même message.
3. Enregistrez la réponse dans Fichiers sous forme de fichier `.json`, ou copiez simplement le texte JSON.
4. Dans l’application, touchez **Choisir le fichier du reçu**, ou collez le texte puis touchez **Analyser**.
5. Vérifiez l’aperçu (correspondances, quantités, liste de courses associée), puis touchez **Importer**.

## Structure

Fichier JSON en UTF-8 : un objet avec quatre parties.

```json
{
  "format": "maison-courses-recu",
  "version": 1,
  "recu": { … },
  "articles": [ { … }, { … } ],
  "incertitudes": [ "…" ]
}
```

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `format` | texte | oui | Toujours `"maison-courses-recu"`. |
| `version` | nombre | oui | `1`. Un fichier d’une version plus récente est refusé. |
| `recu` | objet | oui | En-tête du reçu (voir ci-dessous). |
| `articles` | liste | oui, au moins un | Une entrée par ligne d’article du reçu, dans l’ordre du reçu. |
| `incertitudes` | liste de textes | non | Remarques générales (« la date est en partie effacée »…). |

### `recu`

| Champ | Type | Description |
|---|---|---|
| `date` | texte `AAAA-MM-JJ` | Date d’achat. Si elle est absente ou illisible (`null`), la date du jour est utilisée et l’aperçu le signale. |
| `heure` | texte `HH:MM` ou `null` | Heure du reçu. |
| `magasin` | texte | Enseigne (ex. « Maxi »). |
| `succursale` | texte ou `null` | Succursale ou adresse. |
| `numero` | texte ou `null` | Numéro de transaction, s’il est lisible. |
| `devise` | texte | `"CAD"` par défaut. |
| `sousTotal`, `taxes`, `total` | nombres ou `null` | Montants du reçu. |
| `rabaisTotal` | nombre ou `null` | Total des rabais, s’il est imprimé. |

### `articles[]`

| Champ | Type | Description |
|---|---|---|
| `nomRecu` | texte | Texte exact imprimé sur le reçu (ex. `"YOG NAT 0% 750G"`). |
| `produit.id` | texte ou `null` | Identifiant du produit de l’application (ex. `"p-yaourt"`) s’il correspond clairement ; sinon `null`. Les consignes copiées depuis l’application contiennent la liste des identifiants. |
| `produit.nom` | texte | Nom lisible du produit (ex. « Yaourt nature 0 % »). |
| `produit.famille` | texte | Famille de produits (ex. « Yaourts », « Raisins », « Riz »). |
| `produit.variante` | texte ou `null` | Variante (ex. « nature 0 % », « verts sans pépins », « basmati »). |
| `produit.marque` | texte ou `null` | Marque. |
| `produit.categorie` | texte | Une des catégories de l’application (« Fruits », « Produits laitiers »…). |
| `quantite` | nombre | Nombre d’articles ou quantité vendue. Négatif pour un retour. |
| `unite` | texte | Unité pratique : `unité`, `pot`, `paquet`, `pack`, `barquette`, `grappe`, `sac`, `boîte`, `bouteille`, `rouleau`, `kg`, `g`, `L`, `ml`, `douzaine`… Les pluriels et `lb` (livre) sont acceptés. |
| `format` | objet ou `null` | Format d’achat : `libelle` (ex. « pack de 4 pots de 100 g ») et, seulement si elle est imprimée ou visible, `contenance` `{ "quantite": 4, "unite": "pot" }` ou `{ "quantite": 2, "unite": "kg" }`. |
| `poids` | objet ou `null` | Poids pesé en caisse : `{ "quantite": 0.912, "unite": "kg" }` (ou `lb`). |
| `prixUnitaire` | nombre ou `null` | Prix d’une unité. |
| `prixTotal` | nombre ou `null` | Prix de la ligne avant rabais. |
| `rabais` | nombre ou `null` | Rabais appliqué à cet article (positif ; un nombre négatif est aussi accepté). |
| `prixPaye` | nombre ou `null` | Montant payé pour la ligne, rabais déduits. S’il manque, il est calculé à partir de `prixTotal` moins `rabais`. |
| `incertain` | liste de textes | Noms des champs douteux, ex. `["quantite", "prixPaye"]`. |
| `illisible` | booléen | `true` si la ligne est illisible : elle est proposée « Ne pas ajouter au stock ». |
| `confiance` | `"haute"`, `"moyenne"` ou `"faible"` | Confiance de la lecture. |
| `note` | texte ou `null` | Remarque sur la ligne. |

Les montants sont des nombres avec un point décimal (`4.99`). Une virgule (`"4,99"`) est tolérée. Un bloc de code Markdown (```` ```json … ``` ````) autour du JSON est aussi accepté.

## Ce que fait l’application à l’import

- **Ajout uniquement.** L’import ajoute les quantités achetées au stock. Il ne remplace jamais une quantité et ne la diminue jamais : les retours et remboursements sont ignorés. Un stock « inconnu » devient « au moins la quantité achetée », comme pour un achat coché en magasin.
- **Correspondances.** Chaque ligne est rapprochée d’un produit dans cet ordre :
  1. l’identifiant fourni ;
  2. un nom de reçu déjà associé lors d’un import précédent (l’application l’apprend) ;
  3. le même nom de produit ;
  4. la famille et la variante ;
  5. un nom ressemblant, signalé « à vérifier ».

  Sans correspondance, un nouveau produit est proposé dans la bonne famille ; la famille est créée si elle n’existe pas.
- **Quantités.** La quantité est convertie dans l’unité de stock du produit seulement si la conversion est fiable :
  - unités standard (g ↔ kg, ml ↔ L, lb → kg) ;
  - conversions enregistrées dans la fiche produit ;
  - contenance imprimée du format (1 pack de 4 pots → 4 pots ; 1 sac de 2 kg → 2 kg) ;
  - poids pesé.

  Sinon (ex. une barquette pour un produit suivi en grappes), l’aperçu demande la quantité : rien n’est deviné.
- **Prix.**
  - Le prix payé met à jour le **dernier prix connu** du produit et son prix de référence (marqué « vérifié »).
  - Chaque prix est ajouté à l’**historique des prix**.
  - Un reçu plus ancien que le dernier prix connu enrichit l’historique sans le remplacer.
- **Doublons.** Une empreinte du contenu du reçu est calculée : date, heure, magasin, numéro, total, et pour chaque ligne le nom, la quantité et le prix. Le même reçu est refusé une seconde fois, même s’il a été régénéré ou remis en forme. Un reçu différent du même magasin, du même jour et du même total est signalé.
- **Liste de courses.** Si une liste est associée :
  - les articles prévus sont cochés ;
  - un article déjà coché en magasin, dont le stock a déjà été mis à jour, n’est pas ajouté une seconde fois ; seul un éventuel surplus l’est ;
  - une variante équivalente achetée à la place (raisins verts au lieu de rouges) coche la ligne prévue.
- **Traçabilité.** Chaque import est enregistré :
  - le fichier, la date et la liste associée ;
  - ce qui a été ajouté, créé, déjà compté ou ignoré.

  Les mouvements de stock indiquent le reçu d’origine et peuvent être corrigés depuis l’historique de la fiche produit.

## Exemple minimal

```json
{
  "format": "maison-courses-recu",
  "version": 1,
  "recu": { "date": "2026-10-28", "magasin": "Maxi", "devise": "CAD", "total": 7.99 },
  "articles": [
    {
      "nomRecu": "RIZ BASMATI 2KG",
      "produit": { "id": "p-riz", "nom": "Riz basmati", "famille": "Riz", "variante": "basmati", "marque": null, "categorie": "Féculents et céréales" },
      "quantite": 1,
      "unite": "sac",
      "format": { "libelle": "sac 2 kg", "contenance": { "quantite": 2, "unite": "kg" } },
      "poids": null,
      "prixUnitaire": 8.99,
      "prixTotal": 8.99,
      "rabais": 1.0,
      "prixPaye": 7.99,
      "incertain": [],
      "illisible": false,
      "confiance": "haute",
      "note": null
    }
  ],
  "incertitudes": []
}
```
