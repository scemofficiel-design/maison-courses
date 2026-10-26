import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout sur la version de production servie sous le sous-chemin
 * de GitHub Pages (/maison-courses/), avec service worker actif.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173/maison-courses/',
    locale: 'fr-CA',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'npm run build:pages && npx vite preview --port 4173 --strictPort --base=/maison-courses/',
    url: 'http://localhost:4173/maison-courses/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
