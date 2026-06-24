import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsClient } from './helpers'

test('la página de login muestra el estilo póster y los accesos demo', async ({
  page,
}) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /Voice/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Admin', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Cliente', exact: true }),
  ).toBeVisible()
})

test('el admin accede a métricas globales', async ({ page }) => {
  await loginAsAdmin(page)
})

test('un cliente sin método de pago es enviado al onboarding', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Cliente', exact: true }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(
    page.getByRole('heading', { name: /método de pago/i }),
  ).toBeVisible()
})

test('el cliente supera el gate de pago y llega al dashboard', async ({
  page,
}) => {
  await loginAsClient(page)
})
