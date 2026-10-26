import type { LineStatus, ListStatus, MealSlot, MealStatus } from '../domain/types';

/**
 * Libellés de l'interface. Une future version anglaise ajoutera un dictionnaire `en`
 * de même forme et un sélecteur de langue dans les paramètres.
 */
export const fr = {
  appName: 'Maison & Courses',
  nav: {
    home: 'Accueil',
    stocks: 'Stocks',
    shopping: 'Courses',
    menus: 'Menus',
    recipes: 'Recettes',
    profiles: 'Profils',
    settings: 'Paramètres',
    more: 'Plus',
  },
  slots: {
    'petit-déjeuner': 'Petit-déjeuner',
    'collation-matin': 'Collation du matin',
    déjeuner: 'Déjeuner (midi)',
    'collation-après-midi': 'Collation de l’après-midi',
    dîner: 'Dîner (soir)',
  } satisfies Record<MealSlot, string>,
  slotsShort: {
    'petit-déjeuner': 'Matin',
    'collation-matin': '10 h',
    déjeuner: 'Midi',
    'collation-après-midi': '16 h',
    dîner: 'Soir',
  } satisfies Record<MealSlot, string>,
  mealStatus: { prévu: 'Prévu', validé: 'Validé', préparé: 'Préparé', archivé: 'Archivé' } satisfies Record<MealStatus, string>,
  listStatus: { 'à préparer': 'À préparer', 'en cours': 'En cours', terminée: 'Terminée', archivée: 'Archivée' } satisfies Record<ListStatus, string>,
  lineStatus: { 'à acheter': 'À acheter', acheté: 'Acheté', indisponible: 'Indisponible', retiré: 'Retiré' } satisfies Record<LineStatus, string>,
  backupWarning:
    'Les données sont enregistrées uniquement sur cet appareil. Le stockage d’un iPhone n’est pas une sauvegarde garantie : Safari peut effacer les données d’un site peu utilisé, et elles disparaissent si l’application est supprimée de l’écran d’accueil. Exportez régulièrement une sauvegarde.',
  prescriptionWarning:
    'Cette règle provient de la prescription du document fourni. Avant de la modifier, vérifiez avec le professionnel de santé concerné.',
};

export type Dict = typeof fr;
export const t = fr;

export const SLOTS: MealSlot[] = ['petit-déjeuner', 'collation-matin', 'déjeuner', 'collation-après-midi', 'dîner'];
export const MAIN_SLOTS: MealSlot[] = ['déjeuner', 'dîner'];
