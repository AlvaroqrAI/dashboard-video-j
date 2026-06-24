import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test('no hay errores de consola al navegar por el backoffice', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  await loginAsAdmin(page)
  await page.getByRole('link', { name: 'Clientes' }).click()
  await page.getByRole('link', { name: 'Alertas' }).click()

  // Filtra fallos de red esperados en demo (llamadas a Edge Functions sin sesión real).
  const relevant = errors.filter(
    (e) => !/Failed to load resource|net::|invoke|Functions|401|403/i.test(e),
  )
  expect(relevant, relevant.join('\n')).toEqual([])
})

test('estilo póster: esquinas cuadradas y tipografía Archivo', async ({
  page,
}) => {
  await page.goto('/login')
  const btn = page.getByRole('button', { name: 'Entrar' })
  const radius = await btn.evaluate((el) => getComputedStyle(el).borderRadius)
  expect(radius).toBe('0px')
  const font = await btn.evaluate((el) => getComputedStyle(el).fontFamily)
  expect(font.toLowerCase()).toContain('archivo')
})

test('titulares gigantes en mayúsculas tipo póster', async ({ page }) => {
  await loginAsAdmin(page)
  const h1 = page.getByRole('heading', { name: 'Métricas globales' })
  const transform = await h1.evaluate((el) => getComputedStyle(el).textTransform)
  expect(transform).toBe('uppercase')
  const weight = await h1.evaluate((el) => getComputedStyle(el).fontWeight)
  expect(['800', '900']).toContain(weight)
})
