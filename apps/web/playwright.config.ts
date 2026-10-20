import { defineConfig, devices } from '@playwright/test';

/**
 * Valida o app nos três mundos: desktop (Chrome), Android (Pixel, Chromium) e iOS (iPhone e iPad, WebKit).
 * Rode `npm run build` antes. Veja docs/testes-de-plataforma.md.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  fullyParallel: false,
  workers: 1,
  retries: 1, // o WebKit no Windows às vezes engasga na primeira carga
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/start-server.mjs',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    { name: 'android-pixel', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] } },
  ],
});
