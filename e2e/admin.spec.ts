import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page)
})

test('navega por todas las secciones del backoffice', async ({ page }) => {
  await page.getByRole('link', { name: 'Clientes' }).click()
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()

  await page.getByRole('link', { name: 'Agentes', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Agentes', exact: true }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Planes y precios' }).click()
  await expect(
    page.getByRole('heading', { name: 'Planes y productos' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Alertas' }).click()
  await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible()
})

test('el formulario de nuevo cliente pide nombre, email y contraseña', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Clientes' }).click()
  await page.getByRole('button', { name: '+ Nuevo cliente' }).click()
  await expect(page.getByPlaceholder('Nombre / empresa')).toBeVisible()
  await expect(page.getByPlaceholder('Email')).toBeVisible()
  await expect(page.getByPlaceholder('Contraseña')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear cliente' })).toBeVisible()
})

test('el formulario de nuevo agente pide nombre, agent id, cliente y estado', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Agentes', exact: true }).click()
  await page.getByRole('button', { name: '+ Nuevo agente' }).click()
  await expect(page.getByPlaceholder('Nombre del agente')).toBeVisible()
  await expect(page.getByPlaceholder('Agent ID (de Retell)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear agente' })).toBeVisible()
  // El desplegable de cliente (con opción "Sin asignar") debe existir.
  await expect(page.locator('select').first()).toBeVisible()
})

test('el backoffice NO expone las vistas de cliente', async ({ page }) => {
  // "Números" es exclusivo del cliente; el admin sí tiene su propia vista de
  // "Llamadas" (todas las del sistema), así que no se comprueba aquí.
  const sidebar = page.locator('aside')
  await expect(sidebar.getByText('Números')).toHaveCount(0)
})

test('el formulario de planes pide precio mensual y por minuto', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Planes y precios' }).click()
  await page.getByRole('button', { name: '+ Nuevo producto' }).click()
  await expect(page.getByText('Precio mensual (€)')).toBeVisible()
  await expect(page.getByText('Precio por minuto (€)')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Crear producto' }),
  ).toBeVisible()
})

test('Facturación se eliminó del admin y Métricas muestra MRR', async ({
  page,
}) => {
  await expect(page.locator('aside').getByText('Facturación')).toHaveCount(0)
  await expect(page.getByText('MRR', { exact: true })).toBeVisible()
})
