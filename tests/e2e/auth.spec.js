import { test, expect } from '@playwright/test'

test('register and login flow', async ({ page, baseURL }) => {
  const email = `test-${Date.now()}@example.com`
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD || 'Password123'

  await page.goto(`${baseURL}/register`)
  await page.fill('[name="name"]', 'Test User')
  await page.fill('[name="email"]', email)
  await page.fill('[name="password"]', password)
  await page.fill('[name="confirmPassword"]', password)
  await page.click('[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard$/)

  await page.click('[data-testid="logout"]')
  await expect(page).toHaveURL(/\/login$/)

  await page.goto(`${baseURL}/login`)
  await page.fill('[name="email"]', email)
  await page.fill('[name="password"]', password)
  await page.click('[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard$/)
})
