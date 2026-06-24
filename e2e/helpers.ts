import { type Page, expect } from '@playwright/test'

// Inicia sesión como administrador usando el acceso demo.
export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Admin', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(
    page.getByRole('heading', { name: 'Métricas globales' }),
  ).toBeVisible()
}

// Inicia sesión como cliente y supera el gate de método de pago (demo).
export async function loginAsClient(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Cliente', exact: true }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByRole('button', { name: 'Añadir método de pago' }).click()
  await expect(page).toHaveURL(/:5174\/$/)
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible()
}
