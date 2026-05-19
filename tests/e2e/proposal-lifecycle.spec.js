import { test, expect } from '@playwright/test'

const runLifecycleE2E = process.env.PLAYWRIGHT_ENABLE_LIFECYCLE === 'true'

test.describe('proposal lifecycle', () => {
  test.skip(!runLifecycleE2E, 'Set PLAYWRIGHT_ENABLE_LIFECYCLE=true to run local lifecycle coverage.')
  test.describe.configure({ mode: 'serial' })

  test('scores, generates, shares, and tracks proposal outcomes', async ({ page, baseURL }) => {
    const email = `lifecycle-${Date.now()}@example.com`
    const password = process.env.PLAYWRIGHT_TEST_PASSWORD || 'Password123!'

    await page.goto(`${baseURL}/register`)
    await page.fill('[name="name"]', 'Lifecycle User')
    await page.fill('[name="email"]', email)
    await page.fill('[name="password"]', password)
    await page.fill('[name="confirmPassword"]', password)
    await page.click('[type="submit"]')

    await expect(page).toHaveURL(/\/dashboard$/)

    await page.goto(`${baseURL}/new`)
    await page.locator('textarea').fill(`
      We need a client proposal workspace for our services team.
      The first release should include a dashboard, admin portal, client-facing view, analytics, and Stripe plus Salesforce integrations.
      We need to launch in six weeks with a budget between $25,000 and $40,000.
      Stakeholders include the CTO, delivery lead, and account managers.
      Success will be measured by faster turnaround time, better win rate visibility, and client engagement on shared proposals.
    `)

    await expect(page.getByTestId('brief-score-panel')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('generate-proposal').click()

    await expect(page).toHaveURL(/\/proposal\/.+$/)
    const proposalUrl = page.url()
    await page.getByTestId('open-share-modal').click()
    await page.getByText('Create portal').click()

    await expect(page.getByText('Copy link')).toBeVisible()
    const shareText = await page.locator('text=/\\/p\\//').first().textContent()
    const portalUrl = shareText?.match(/https?:\/\/\S+/)?.[0]
    expect(portalUrl).toBeTruthy()

    await page.goto(portalUrl)
    await expect(page.getByText(/Shared by/i)).toBeVisible()
    await page.getByPlaceholder(/Share what needs to change/i).fill('Please tighten the analytics deliverables and phase-one scope.')
    await page.getByText('Submit feedback').click()

    await page.goto(proposalUrl)
    await page.locator('[data-testid="deal-status-selector"]').selectOption('won')
    await expect(page.getByText('Won deal kickoff package')).toBeVisible({ timeout: 15000 })

    await page.goto(`${baseURL}/analytics`)
    await expect(page.getByTestId('analytics-page')).toBeVisible()
  })
})
