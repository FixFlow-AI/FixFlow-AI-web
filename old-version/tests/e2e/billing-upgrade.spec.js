import { test, expect } from '@playwright/test'

async function authenticate(page, userOverrides = {}) {
  const user = {
    id: 'u1',
    name: 'Billing Owner',
    email: 'billing@example.com',
    avatar: '/avatar.png',
    plan: 'free',
    defaultEntryMode: 'individual',
    billingUsage: {
      proposalsThisMonth: 4,
      proposalLimit: 5,
      nearLimit: true,
      limitReached: false,
      unlimited: false,
    },
    capabilities: { agencyBrain: false, triProposal: false },
    ...userOverrides,
  }

  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'mock-access')
    localStorage.setItem('refreshToken', 'mock-refresh')
  })

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({ json: { accessToken: 'mock-access', refreshToken: 'mock-refresh' } })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ json: { user, currentWorkspace: null } })
  })

  await page.route('**/api/notifications**', async (route) => {
    await route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  await page.route('**/api/notifications/stream**', async (route) => {
    await route.fulfill({
      headers: { 'content-type': 'text/event-stream' },
      body: ': connected\n\n',
    })
  })

  return user
}

test('billing page starts Stripe Checkout only for configured paid plans', async ({ page, baseURL }) => {
  await authenticate(page)

  let checkoutPlan = ''
  await page.route('**/api/billing/status', async (route) => {
    await route.fulfill({
      json: {
        plan: 'free',
        subscriptionStatus: 'none',
        stripeConfigured: true,
        stripeCustomerId: '',
        usage: {
          proposalsThisMonth: 4,
          proposalLimit: 5,
          nearLimit: true,
          limitReached: false,
          unlimited: false,
        },
        priceIdsConfigured: {
          pro: true,
          agency: false,
          solo: true,
        },
      },
    })
  })

  await page.route('**/api/billing/checkout-session', async (route) => {
    checkoutPlan = route.request().postDataJSON().plan
    await route.fulfill({ json: { checkoutUrl: `${baseURL}/mock-checkout?plan=${checkoutPlan}` } })
  })

  await page.route('**/api/billing/portal-session', async (route) => {
    await route.fulfill({ status: 400, json: { error: 'No Stripe customer found.' } })
  })

  await page.goto(`${baseURL}/billing`)
  await expect(page.getByTestId('billing-page')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('billing-page').getByTestId('billing-usage-meter').getByText('4/5')).toBeVisible()

  await expect(page.getByTestId('billing-plan-agency').getByRole('button', { name: 'Upgrade' })).toBeDisabled()
  await page.getByTestId('billing-plan-pro').getByRole('button', { name: 'Upgrade' }).click()

  await expect.poll(() => checkoutPlan).toBe('pro')
  await expect(page).toHaveURL(/\/mock-checkout\?plan=pro$/)
})

test('billing page disables upgrades when Stripe is not configured', async ({ page, baseURL }) => {
  await authenticate(page)

  await page.route('**/api/billing/status', async (route) => {
    await route.fulfill({
      json: {
        plan: 'free',
        subscriptionStatus: 'none',
        stripeConfigured: false,
        usage: {
          proposalsThisMonth: 5,
          proposalLimit: 5,
          nearLimit: true,
          limitReached: true,
          unlimited: false,
        },
        priceIdsConfigured: {
          pro: false,
          agency: false,
          solo: false,
        },
      },
    })
  })

  await page.goto(`${baseURL}/billing`)
  await expect(page.getByText('Stripe is not configured on this backend.')).toBeVisible()
  await expect(page.getByTestId('billing-plan-pro').getByRole('button', { name: 'Upgrade' })).toBeDisabled()
  await expect(page.getByTestId('billing-page').getByTestId('billing-usage-meter').getByText('5/5')).toBeVisible()
})
