import { test, expect } from '@playwright/test'
import { loginAsClient } from './helpers'

test.beforeEach(async ({ page }) => {
  await loginAsClient(page)
})

test('navega por todas las secciones del cliente', async ({ page }) => {
  await page.getByRole('link', { name: 'Agentes de voz' }).click()
  await expect(
    page.getByRole('heading', { name: 'Agentes de voz' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Llamadas' }).click()
  await expect(page.getByRole('heading', { name: 'Llamadas' })).toBeVisible()

  await page.getByRole('link', { name: 'Números' }).click()
  await expect(
    page.getByRole('heading', { name: 'Números de teléfono' }),
  ).toBeVisible()

  // Facturación y Ajustes viven ahora en el menú de usuario del sidebar.
  await page.getByRole('button', { name: 'Menú de usuario' }).click()
  await page.getByRole('link', { name: 'Facturación' }).click()
  await expect(page.getByRole('heading', { name: 'Facturación' })).toBeVisible()

  await page.getByRole('button', { name: 'Menú de usuario' }).click()
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible()
})

test('la página de llamadas carga (datos reales de Retell)', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Llamadas' }).click()
  await expect(page.getByRole('heading', { name: 'Llamadas' })).toBeVisible()
  // En modo demo no hay sesión real, así que muestra el estado vacío sin romperse.
  await expect(
    page.getByText(/no te ha asignado agentes|no hay llamadas/i),
  ).toBeVisible({ timeout: 10_000 })
})

test('el panel de cliente NO expone vistas de administración', async ({
  page,
}) => {
  const sidebar = page.locator('aside')
  await expect(sidebar.getByText('Clientes')).toHaveCount(0)
  await expect(sidebar.getByText('Planes')).toHaveCount(0)
  await expect(sidebar.getByText('Métricas')).toHaveCount(0)
})
