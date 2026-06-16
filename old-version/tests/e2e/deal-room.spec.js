import { test, expect } from '@playwright/test'

const proposalData = {
  project_summary: 'A focused launch plan for a client proposal workspace with analytics and buyer collaboration.',
  features: [
    {
      title: 'Client Portal',
      description: 'Read-only proposal access with deal-room annotations.',
      confidence_pct: 88,
      technical_approach: 'Token-authenticated public portal with section-level events.',
      area: 'Portal',
      complexity: 'Medium',
    },
    {
      title: 'Billing Gate',
      description: 'Plan and quota enforcement before generation.',
      confidence_pct: 84,
      technical_approach: 'Stripe-backed subscription sync and usage counters.',
      area: 'Billing',
      complexity: 'Medium',
    },
  ],
  risks: [
    {
      label: 'Webhook drift',
      severity: 54,
      mitigation: 'Use idempotent subscription sync and replay-safe updates.',
    },
  ],
  timeline: [
    {
      phase: 'Phase 1',
      duration: '2 weeks',
      deliverables: ['Deal Room annotations', 'Billing gate'],
    },
  ],
  effort: [
    {
      label: 'Backend',
      percentage: 45,
      duration: '1 week',
    },
    {
      label: 'Frontend',
      percentage: 55,
      duration: '1 week',
    },
  ],
  market: [],
  impact: [],
}

test('public portal submits deal-room annotation and tier selection without login', async ({ page, baseURL }) => {
  const token = 'public-token'
  const requests = {
    annotation: null,
    tierSelection: null,
  }

  await page.route(`**/api/portal/${token}**`, async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname.endsWith(`/api/portal/${token}/verify`)) {
      await route.fulfill({
        json: {
          proposal: {
            proposalId: 'proposal-1',
            title: 'FixFlowAI Launch',
            projectSummary: proposalData.project_summary,
            data: proposalData,
          },
          bundle: {
            proposals: [
              {
                proposalId: 'proposal-1',
                title: 'Pro launch',
                strategy: 'pro',
                projectSummary: proposalData.project_summary,
                data: proposalData,
              },
              {
                proposalId: 'proposal-2',
                title: 'Agency launch',
                strategy: 'agency',
                projectSummary: proposalData.project_summary,
                data: proposalData,
              },
            ],
          },
        },
      })
      return
    }

    if (url.pathname.endsWith(`/api/portal/${token}/event`)) {
      await route.fulfill({ json: { ok: true } })
      return
    }

    if (url.pathname.endsWith(`/api/portal/${token}/feedback`)) {
      await route.fulfill({ json: { ok: true } })
      return
    }

    if (url.pathname.endsWith(`/api/portal/${token}/deal-room/annotations`)) {
      requests.annotation = route.request().postDataJSON()
      await route.fulfill({
        status: 201,
        json: {
          annotation: {
            id: 'annotation-1',
            ...requests.annotation,
          },
        },
      })
      return
    }

    if (url.pathname.endsWith(`/api/portal/${token}/deal-room/tier-selection`)) {
      requests.tierSelection = route.request().postDataJSON()
      await route.fulfill({
        json: {
          tierSelection: requests.tierSelection,
        },
      })
      return
    }

    await route.fulfill({
      json: {
        agencyName: 'FixFlow Studio',
        requiresPin: false,
        expiryAt: null,
      },
    })
  })

  await page.goto(`${baseURL}/p/${token}`)
  await expect(page.getByText('Shared by FixFlow Studio')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('deal-room-panel')).toBeVisible()

  await page.getByTestId('deal-room-client-email').fill('client@example.com')
  await page.getByTestId('deal-room-section').selectOption('risks')
  await page.getByTestId('deal-room-type').selectOption('concern')
  await page.getByTestId('deal-room-comment').fill('Can you clarify the webhook replay risk?')
  await page.getByRole('button', { name: 'Send comment' }).click()

  await expect.poll(() => requests.annotation?.comment).toBe('Can you clarify the webhook replay risk?')
  expect(requests.annotation).toMatchObject({
    proposalId: 'proposal-1',
    sectionName: 'risks',
    type: 'concern',
    clientEmail: 'client@example.com',
  })
  await expect(page.getByText('Your update has been sent.')).toBeVisible()

  await page.getByTestId('deal-room-panel').getByRole('button', { name: 'Request this approach' }).click()
  await expect.poll(() => requests.tierSelection?.strategy).toBe('pro')
  expect(requests.tierSelection).toMatchObject({
    proposalId: 'proposal-1',
    strategy: 'pro',
    clientEmail: 'client@example.com',
  })
})
