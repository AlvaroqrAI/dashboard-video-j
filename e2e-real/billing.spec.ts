import { test, expect, type Page } from '@playwright/test'

const CLIENT_EMAIL = 'e2e-cliente@umindsai.com'
const CLIENT_PASS = (process.env.E2E_CLIENT_PASSWORD || '')

async function loginReal(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('la facturación del cliente muestra plan y método de pago reales', async ({
  page,
}) => {
  await loginReal(page, CLIENT_EMAIL, CLIENT_PASS)
  await expect(page).toHaveURL(/:5175\/$/)

  // Facturación vive ahora en el menú de usuario del sidebar.
  await page.getByRole('button', { name: 'Menú de usuario' }).click()
  await page.getByRole('link', { name: 'Facturación' }).click()
  await expect(page.getByRole('heading', { name: 'Facturación' })).toBeVisible()

  // El plan real asignado debe mostrarse (no un texto ficticio).
  await expect(page.getByText(/Pack Ultra|\/mes|\/min/).first()).toBeVisible({
    timeout: 15_000,
  })
  // El método de pago real (Visa ••••).
  await expect(page.getByText(/VISA •••• \d{4}/i)).toBeVisible({ timeout: 15_000 })
})

test('el botón Gestionar suscripción abre el portal de Stripe', async ({
  page,
}) => {
  await loginReal(page, CLIENT_EMAIL, CLIENT_PASS)
  await page.getByRole('button', { name: 'Menú de usuario' }).click()
  await page.getByRole('link', { name: 'Facturación' }).click()
  await expect(page.getByRole('heading', { name: 'Facturación' })).toBeVisible()

  await page
    .getByRole('button', { name: 'Gestionar suscripción (Stripe)' })
    .click()
  // Debe redirigir al portal de cliente de Stripe.
  await page.waitForURL(/billing\.stripe\.com/, { timeout: 20_000 })
  expect(page.url()).toContain('billing.stripe.com')
})
