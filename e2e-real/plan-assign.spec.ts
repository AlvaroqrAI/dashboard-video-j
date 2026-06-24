import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL = 'e2e-admin@umindsai.com'
const ADMIN_PASS = (process.env.E2E_ADMIN_PASSWORD || '')

async function loginReal(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('el plan se elige por PRODUCTO único con sus precios combinados', async ({
  page,
}) => {
  await loginReal(page, ADMIN_EMAIL, ADMIN_PASS)
  await expect(page).toHaveURL(/\/admin$/)

  // Ir a Clientes y abrir el cliente de prueba.
  await page.getByRole('link', { name: 'Clientes' }).click()
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()

  await page
    .getByRole('row', { name: /Clínica E2E/ })
    .getByRole('link', { name: 'Gestionar' })
    .click()

  // En el detalle, el desplegable de plan debe existir.
  await expect(page.getByRole('heading', { name: 'Plan asignado' })).toBeVisible()
  const select = page.locator('select').first()
  // Esperar a que las opciones se carguen desde Stripe (más allá del placeholder).
  await expect
    .poll(async () => await select.locator('option').count(), { timeout: 15_000 })
    .toBeGreaterThan(1)
  const options = await select.locator('option').allTextContents()

  // Debe existir UNA sola opción que contenga AMBOS precios (mensual + por minuto),
  // demostrando que se asigna un producto, no precios sueltos.
  const combined = options.find((o) => o.includes('/mes') && o.includes('/min'))
  expect(combined, `opciones: ${JSON.stringify(options)}`).toBeTruthy()
})

test('asignar el producto al cliente lo guarda y se refleja', async ({
  page,
}) => {
  await loginReal(page, ADMIN_EMAIL, ADMIN_PASS)
  await page.getByRole('link', { name: 'Clientes' }).click()
  await page
    .getByRole('row', { name: /Clínica E2E/ })
    .getByRole('link', { name: 'Gestionar' })
    .click()
  await expect(page.getByRole('heading', { name: 'Plan asignado' })).toBeVisible()

  // Elegir el producto combinado y asignarlo.
  const select = page.locator('select').first()
  const combined = page.locator('select').first().locator('option', {
    hasText: '/min',
  })
  const value = await combined.first().getAttribute('value')
  await select.selectOption(value!)
  await page.getByRole('button', { name: 'Asignar plan' }).click()

  await expect(page.getByText('Plan asignado.', { exact: true })).toBeVisible()
})
