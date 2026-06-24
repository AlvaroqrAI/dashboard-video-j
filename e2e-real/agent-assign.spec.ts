import { test, expect, type Page } from '@playwright/test'

async function loginReal(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('crear un agente y asignarlo a un cliente (flujo completo)', async ({
  page,
}) => {
  const uid = `e2e_ui_${Date.now()}`

  await loginReal(page, 'e2e-admin@umindsai.com', (process.env.E2E_ADMIN_PASSWORD || ''))
  await expect(page).toHaveURL(/\/admin$/)

  // 1) Crear un agente SIN asignar en la pestaña Agentes.
  await page.getByRole('link', { name: 'Agentes', exact: true }).click()
  await page.getByRole('button', { name: '+ Nuevo agente' }).click()
  await page.getByPlaceholder('Nombre del agente').fill(`UI ${uid}`)
  await page.getByPlaceholder('Agent ID (de Retell)').fill(uid)
  await page.getByRole('button', { name: 'Crear agente' }).click()
  await expect(page.locator('body')).toContainText(/agente creado/i, {
    timeout: 10_000,
  })

  // 2) Ir al cliente y asignarle ese agente desde el dropdown de disponibles.
  await page.getByRole('link', { name: 'Clientes' }).click()
  await page
    .getByRole('row', { name: /Clínica E2E/ })
    .getByRole('link', { name: 'Gestionar' })
    .click()
  await expect(page.getByRole('heading', { name: 'Agentes del cliente' })).toBeVisible()

  // El select de agentes disponibles es el segundo de la página (el primero es el plan).
  const agentSelect = page.locator('select').nth(1)
  const option = agentSelect.locator('option', { hasText: uid })
  const value = await option.first().getAttribute('value')
  await agentSelect.selectOption(value!)
  await page.getByRole('button', { name: 'Asignar agente' }).click()

  await expect(page.locator('body')).toContainText(/agente asignado/i, {
    timeout: 10_000,
  })
})
