import { test, expect, type Page } from '@playwright/test'

async function loginReal(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('el cliente ve llamadas reales con grabación, transcripción y números', async ({
  page,
}) => {
  await loginReal(page, 'e2e-cliente@umindsai.com', (process.env.E2E_CLIENT_PASSWORD || ''))
  await expect(page).toHaveURL(/:5175\/$/)

  await page.getByRole('link', { name: 'Llamadas' }).click()
  await expect(page.getByRole('heading', { name: 'Llamadas' })).toBeVisible()

  // Esperar a que cargue al menos una llamada real desde Retell.
  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 20_000 })

  // La fila muestra los números de teléfono (de → a).
  await expect(firstRow).toContainText('+')

  // Abrir el detalle.
  await firstRow.click()
  await expect(page.getByText('Transcripción')).toBeVisible()
  await expect(page.locator('audio')).toBeVisible()
  // Los números aparecen en el detalle.
  await expect(page.locator('audio')).toHaveAttribute('src', /https?:\/\//)
})
