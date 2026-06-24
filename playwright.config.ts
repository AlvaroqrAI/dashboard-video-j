import { defineConfig, devices } from '@playwright/test'

// Las pruebas E2E se ejecutan contra un servidor de desarrollo levantado en MODO DEMO
// (VITE_DEMO_MODE=true) en el puerto 5174, aislado de tu app normal en 5173.
// Esto permite probar los flujos de admin y cliente sin credenciales reales.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'VITE_DEMO_MODE=true npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
