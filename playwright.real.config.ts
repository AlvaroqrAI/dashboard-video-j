import { defineConfig, devices } from '@playwright/test'

// Pruebas E2E contra el BACKEND REAL (Supabase + Stripe), sin modo demo.
// Levanta el dev server con VITE_DEMO_MODE=false en el puerto 5175.
// Usa los usuarios de prueba e2e-admin@umindsai.com / e2e-cliente@umindsai.com.
export default defineConfig({
  testDir: './e2e-real',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'VITE_DEMO_MODE=false npm run dev -- --port 5175 --strictPort',
    url: 'http://localhost:5175',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
