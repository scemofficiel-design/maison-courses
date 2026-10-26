/** Génère docs/IMPORT_PLAN_FAMILIAL.md à partir des contrôles de vérification (npx vite-node scripts/import-report.ts). */
import { writeFileSync } from 'node:fs';
import { buildSeed } from '../src/seed/build';
import { DOCUMENT_NAME, MENU_WEEKS, SHOPPING_ROWS } from '../src/seed/planDocument';
import { MENU_ITEM_RECIPE, RECIPES } from '../src/seed/recipes';
import { verifySeed } from '../src/seed/verify';

const seed = buildSeed('2026-10-26T00:00:00.000Z');
const r = verifySeed(seed);
const names = new Map(RECIPES.map((x) => [x.id, x.name]));
const lines: string[] = [];
lines.push(`# Rapport d’importation — ${DOCUMENT_NAME}`, '');
lines.push('Rapport généré automatiquement par `scripts/import-report.ts` à partir des contrôles de `src/seed/verify.ts` (également exécutés par les tests unitaires et affichés dans Paramètres).', '');
lines.push('## Contrôles', '', '| Contrôle | Résultat | Détail |', '|---|---|---|');
for (const c of r.checks) lines.push(`| ${c.label} | ${c.ok ? '✅' : '❌'} | ${c.detail} |`);
lines.push('', '## Ce qui a été importé', '');
lines.push(`- **Menus** : ${MENU_WEEKS.length} semaines × 7 jours × (midi + soir), libellés repris à l’identique ; petit-déjeuner hebdomadaire (4 formules) ; collations de 10 h et 16 h.`);
lines.push(`- **Courses** : ${SHOPPING_ROWS.length} produits, 4 listes (P1 à P4) avec quantités, priorités E/O, prix et montants du document (${seed.lines.length} lignes au total).`);
lines.push('- **Budgets** : cible P1 483,86 $, P2 461,12 $, P3 464,87 $, P4 457,11 $ (total 1 866,96 $) ; version économique 429,10 / 421,99 / 423,35 / 414,74 $ (total 1 689,18 $).');
lines.push('- **Profils** : Grand-mère (règles et portions de la prescription), « Nous » (ma mère et moi), « Moi » (2e œuf) ; aucun nom, âge, poids ou diagnostic ajouté.');
lines.push('- **Principes** : méthode des repas communs, cuisiner moins souvent, anti-gaspillage par semaine, garde-manger, leviers d’économie, hypothèses, points à confirmer au diététicien.', '');
lines.push('## Correspondance éléments de menu → recettes', '', '| Élément du menu | Recette |', '|---|---|');
for (const [k, v] of Object.entries(MENU_ITEM_RECIPE)) lines.push(`| ${k} | ${names.get(v)} |`);
lines.push('', '## Interprétations, ambiguïtés et données non importées', '');
for (const n of r.notes) lines.push(`- ${n}`);
lines.push('', 'Les points « à faire confirmer au diététicien » du document sont conservés tels quels dans les règles du profil de Grand-mère (type « à confirmer »).', '');
writeFileSync('docs/IMPORT_PLAN_FAMILIAL.md', lines.join('\n'));
console.log(`${r.checks.filter((c) => c.ok).length}/${r.checks.length} contrôles OK`);
