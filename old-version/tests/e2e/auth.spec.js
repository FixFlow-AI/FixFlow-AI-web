import { test, expect } from '@playwright/test'

async function mockAuthenticatedApis(page, role = 'client') {
  await page.route('**/api/auth/register', async (route) => {
    const body = route.request().postDataJSON()
    await route.fulfill({
      json: {
        user: {
          id: 'user-1',
          _id: 'user-1',
          name: body.name,
          email: body.email,
          role: body.role,
          selectedPlan: body.selectedPlan,
          plan: body.selectedPlan,
          authProvider: 'email',
          billingUsage: { proposalsThisMonth: 0, proposalLimit: 5, unlimited: false },
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    })
  })

  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON()
    await route.fulfill({
      json: {
        user: {
          id: 'user-1',
          _id: 'user-1',
          name: 'Test User',
          email: body.email,
          role: body.role || role,
          selectedPlan: 'free',
          plan: 'free',
          authProvider: 'email',
          billingUsage: { proposalsThisMonth: 0, proposalLimit: 5, unlimited: false },
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    })
  })

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({ json: { message: 'Logged out successfully' } })
  })

  await page.route('**/api/proposals', async (route) => {
    await route.fulfill({ json: { proposals: [] } })
  })
}

test('signup role changes update providers and plans', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/register?role=freelancer`)

  await expect(page.getByTestId('role-freelancer')).toBeVisible()
  await expect(page.getByTestId('github-signup')).toBeVisible()
  await expect(page.getByTestId('google-signup')).toHaveCount(0)
  await expect(page.locator('[name="email"]')).toHaveCount(0)
  await expect(page.getByTestId('plan-select')).toContainText('Solo')

  await page.getByTestId('role-client').click()
  await expect(page.getByTestId('google-signup')).toBeVisible()
  await expect(page.locator('[name="email"]')).toBeVisible()
  await expect(page.getByTestId('plan-select')).toContainText('Pro')

  await page.getByTestId('role-developer').click()
  await expect(page.getByTestId('github-signup')).toBeVisible()
  await expect(page.getByTestId('google-signup')).toBeVisible()
  await expect(page.getByTestId('plan-select')).toContainText('Agency')
})

test('landing role CTAs prefill signup roles', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`)
  await page.getByRole('link', { name: 'Hire Talent as Client' }).first().click()
  await expect(page).toHaveURL(/\/register\?role=client/)
  await expect(page.getByRole('heading', { name: /Create your Client account/i })).toBeVisible()

  await page.goto(`${baseURL}/`)
  await page.getByRole('link', { name: 'Join as Developer' }).first().click()
  await expect(page).toHaveURL(/\/register\?role=developer/)
  await expect(page.getByRole('heading', { name: /Create your Developer account/i })).toBeVisible()
})

test('client register and login flow redirects to client dashboard', async ({ page, baseURL }) => {
  await mockAuthenticatedApis(page, 'client')
  const email = `test-${Date.now()}@example.com`
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD || 'Password123!'

  await page.goto(`${baseURL}/register?role=client`)
  await page.fill('[name="name"]', 'Test Client')
  await page.fill('[name="email"]', email)
  await page.fill('[name="password"]', password)
  await page.fill('[name="confirmPassword"]', password)
  await page.click('[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard$/)

  await page.click('[data-testid="logout"]')
  await expect(page).toHaveURL(/\/login$/)

  await page.goto(`${baseURL}/login?role=client`)
  await page.fill('[name="email"]', email)
  await page.fill('[name="password"]', password)
  await page.click('[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard$/)
})

test('freelancer login shows only GitHub', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/login?role=freelancer`)
  await expect(page.getByTestId('github-login')).toBeVisible()
  await expect(page.getByTestId('google-login')).toHaveCount(0)
  await expect(page.locator('[name="email"]')).toHaveCount(0)
  await expect(page.getByText('Freelancer accounts can only be accessed using GitHub login.')).toBeVisible()
})
