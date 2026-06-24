import { test, expect, type Page } from '@playwright/test'

async function loginReal(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('Ajustes del admin muestra el botón Conectar con Google', async ({
  page,
}) => {
  await loginReal(page, 'e2e-admin@umindsai.com', (process.env.E2E_ADMIN_PASSWORD || ''))
  await expect(page).toHaveURL(/\/admin$/)

  // Ajustes vive ahora en el menú de usuario del sidebar.
  await page.getByRole('button', { name: 'Menú de usuario' }).click()
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible()
  await expect(
    page.getByText('Notificaciones por email (Google)'),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Conectar con Google' }),
  ).toBeVisible({ timeout: 10_000 })
})

