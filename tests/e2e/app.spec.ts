import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function waitReady(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
}

/** Attend que le service worker contrôle la page (mise en cache terminée). */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20_000 });
  }
}

test('test 19 — fonctionne sous le sous-chemin GitHub Pages (manifeste, icônes, service worker)', async ({ page, request }) => {
  await page.goto('./');
  await waitReady(page);
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible();
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifestUrl = new URL(manifestHref!, page.url()).toString();
  expect(manifestUrl).toBe('http://localhost:4173/maison-courses/manifest.webmanifest');
  const manifest = await (await request.get(manifestUrl)).json();
  expect(manifest.name).toBe('Maison & Courses');
  expect(manifest.start_url).toBe('.');
  for (const icon of manifest.icons) {
    const res = await request.get(new URL(icon.src, manifestUrl).toString());
    expect(res.status(), icon.src).toBe(200);
  }
  expect((await request.get('apple-touch-icon.png')).status()).toBe(200);
  await waitForServiceWorker(page);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe('http://localhost:4173/maison-courses/');
  // Navigation interne (routage par fragment) et rechargement d'une page profonde
  await page.getByRole('link', { name: 'Stocks' }).first().click();
  await expect(page.getByRole('heading', { name: 'Stocks' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Stocks' })).toBeVisible();
});

test('tests 14 et 17 — plan importé, démarrage du plan et données conservées après rechargement', async ({ page }) => {
  await page.goto('./');
  await waitReady(page);
  await expect(page.getByRole('heading', { name: 'Plan familial — 8 semaines avec grand-mère' })).toBeVisible();
  await page.getByRole('button', { name: 'Démarrer', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Démarrer' }).click();
  await expect(page.getByText('Plan démarré')).toBeVisible();
  await page.goto('./#/menus?d=2026-11-02');
  await expect(page.getByText('Riz · sauce claire · tilapia au four')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Riz · sauce claire · tilapia au four')).toBeVisible();
  await page.goto('./#/menus?d=2026-12-27');
  await expect(page.getByText('Igname bouillie · sauce légumes · poulet braisé')).toBeVisible();
});

test('tests 9 et 11 — achat en magasin : stock mis à jour une seule fois', async ({ page }) => {
  await page.goto('./#/courses/list-p1');
  await expect(page.getByRole('heading', { name: 'P1 — semaines 1 et 2' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Cocher Riz basmati' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Valider l’achat/ }).click();
  await expect(page.getByRole('button', { name: /Riz basmati acheté/ })).toBeVisible();
  await page.goto('./#/stocks/p-riz');
  await expect(page.getByText('3 kg', { exact: true })).toBeVisible();
  // Recocher (ouvrir l'article acheté) ne crée pas de second achat
  await page.goto('./#/courses/list-p1');
  await page.getByRole('button', { name: /Riz basmati acheté/ }).click();
  await expect(page.getByRole('dialog').getByText('Prix réellement payé ($)')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('./#/stocks/p-riz');
  await expect(page.getByText('3 kg', { exact: true })).toBeVisible();
});

test('test 16 — fonctionnalités principales hors ligne', async ({ page, context }) => {
  await page.goto('./');
  await waitReady(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await waitReady(page);
  await page.goto('./#/stocks/p-tomate');
  await expect(page.getByRole('heading', { name: 'Tomates grosses' })).toBeVisible();
  await page.getByRole('button', { name: 'Fixer la quantité' }).click();
  await page.getByRole('dialog').getByLabel('Quantité').fill('6');
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('6 unités', { exact: true })).toBeVisible();
  await page.goto('./#/menus?d=2026-11-03');
  await expect(page.getByRole('heading', { name: 'Menus' })).toBeVisible();
  await page.goto('./#/courses');
  await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible();
  await context.setOffline(false);
});

test('test 15 — exportation puis restauration d’une sauvegarde depuis l’interface', async ({ page }) => {
  await page.goto('./#/stocks/p-oignon');
  await expect(page.getByRole('heading', { name: 'Oignons' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Fixer la quantité' }).click();
  await page.getByRole('dialog').getByLabel('Quantité').fill('9');
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('9 unités', { exact: true })).toBeVisible();

  await page.goto('./#/parametres');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter toutes les données' }).click();
  const file = await (await download).path();
  const backup = JSON.parse(readFileSync(file!, 'utf8'));
  expect(backup.app).toBe('maison-courses');
  expect(backup.tables.products.find((p: { id: string }) => p.id === 'p-oignon').quantity).toBe(9);

  // Modifier après la sauvegarde, puis restaurer : la valeur sauvegardée revient.
  await page.goto('./#/stocks/p-oignon');
  await page.getByRole('button', { name: 'Tout épuisé' }).click();
  await expect(page.getByText('0 unité', { exact: true })).toBeVisible();
  await page.goto('./#/parametres');
  await page.locator('input[type="file"]').setInputFiles(file!);
  await page.getByRole('dialog').getByRole('button', { name: 'Remplacer et restaurer' }).click();
  await expect(page.getByText('Sauvegarde restaurée')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.goto('./#/stocks/p-oignon');
  await expect(page.getByText('9 unités', { exact: true })).toBeVisible({ timeout: 20_000 });
});

test('saisie continue au clavier dans les volets (texte et nombres)', async ({ page }) => {
  await page.goto('./#/stocks');
  await expect(page.getByRole('heading', { name: 'Stocks' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Ajouter un produit' }).click();
  const name = page.getByRole('dialog').getByPlaceholder('Ex. Riz basmati');
  await name.click();
  // Frappes une par une, comme sur un clavier de téléphone
  await page.keyboard.type('Riz parfumé', { delay: 30 });
  await expect(name).toHaveValue('Riz parfumé');
  await expect(name).toBeFocused();
  const qty = page.getByRole('dialog').getByLabel('Quantité actuelle');
  await page.getByRole('dialog').getByText('Je ne sais pas ce qu’il reste').click();
  await qty.click();
  await page.keyboard.type('12,5', { delay: 30 });
  await expect(qty).toHaveValue('12,5');
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('searchbox').click();
  await page.keyboard.type('parfum', { delay: 30 });
  await expect(page.getByRole('searchbox')).toHaveValue('parfum');
  await expect(page.getByText('12,5 kg').or(page.getByText('12,5 unités'))).toBeVisible();
});
