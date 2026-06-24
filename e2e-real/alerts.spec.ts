import { test, expect, type Page } from '@playwright/test'

async function loginReal(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('el cliente ve sus alertas reales en el dashboard', async ({ page }) => {
  await loginReal(page, 'e2e-cliente@umindsai.com', (process.env.E2E_CLIENT_PASSWORD || ''))
  await expect(page).toHaveURL(/:5175\/$/)
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible()
  // La alerta creada por el admin debe aparecer como banner.
  await expect(page.getByText(/Mantenimiento programado/i)).toBeVisible({
    timeout: 10_000,
  })
})
