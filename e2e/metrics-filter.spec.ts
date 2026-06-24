import { test, expect } from '@playwright/test'
import { loginAsAdmin, loginAsClient } from './helpers'

test.describe('Filtro de fecha — panel de cliente', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsClient(page)
  })

  test('muestra el filtro con "Esta semana" activo por defecto', async ({
    page,
  }) => {
    const group = page.getByRole('group', { name: 'Filtro de fecha' })
    await expect(group).toBeVisible()
    await expect(group.getByRole('button', { name: 'Esta semana' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(
      page.getByRole('heading', { name: 'Llamadas · Esta semana' }),
    ).toBeVisible()
  })

  test('cambiar a "Hoy" actualiza gráficos y métricas (vista por hora)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Hoy', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Hoy', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('heading', { name: 'Llamadas · Hoy' }),
    ).toBeVisible()
    // La granularidad pasa a por hora, reflejado en la tarjeta de media.
    await expect(page.getByText('Media por hora')).toBeVisible()
  })

  test('cambiar a "Este mes" actualiza el título del gráfico', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Este mes' }).click()
    await expect(
      page.getByRole('heading', { name: 'Llamadas · Este mes' }),
    ).toBeVisible()
    await expect(page.getByText('Media por día')).toBeVisible()
  })

  test('"Personalizado" muestra los selectores de fecha y filtra', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Personalizado' }).click()
    const from = page.getByLabel('Fecha desde')
    const to = page.getByLabel('Fecha hasta')
    await expect(from).toBeVisible()
    await expect(to).toBeVisible()

    // Fijamos un rango concreto y comprobamos que el gráfico sigue presente.
    await from.fill('2026-06-01')
    await to.fill('2026-06-15')
    await expect(
      page.getByRole('heading', { name: /Llamadas · 06\/06 – 06\/15|Llamadas · 01\/06 – 15\/06/ }),
    ).toBeVisible()
  })
})

test.describe('Filtro de fecha — panel de administrador', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('muestra el filtro con "Esta semana" activo por defecto', async ({
    page,
  }) => {
    const group = page.getByRole('group', { name: 'Filtro de fecha' })
    await expect(group).toBeVisible()
    await expect(group.getByRole('button', { name: 'Esta semana' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(
      page.getByRole('heading', { name: 'Volumen de llamadas · Esta semana' }),
    ).toBeVisible()
  })

  test('cambiar a "Hoy" actualiza el gráfico de volumen', async ({ page }) => {
    await page.getByRole('button', { name: 'Hoy', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Hoy', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('heading', { name: 'Volumen de llamadas · Hoy' }),
    ).toBeVisible()
  })

  test('"Personalizado" muestra los selectores de fecha', async ({ page }) => {
    await page.getByRole('button', { name: 'Personalizado' }).click()
    await expect(page.getByLabel('Fecha desde')).toBeVisible()
    await expect(page.getByLabel('Fecha hasta')).toBeVisible()
  })
})
