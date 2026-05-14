import { test, expect } from '@playwright/test'

const profile = {
  id: 'profile-1',
  did: 'did:fixflow:0xmocked',
  walletAddresses: { fixflow: '0xffmock', usdc: '0xusdc', matic: '0xmatic' },
  profiles: {},
  agentConfig: { leadHunter: true, outreachWriter: true, escrowWatcher: true, credentialMinter: false },
}

function makeState() {
  return {
    niches: [
      { id: 'n1', name: 'AI workflow engineering', depth: 91, rateCeiling: 155, evidence: [], reasoning: 'Strong workflow evidence.', tags: ['Gemini'], accepted: true },
      { id: 'n2', name: 'Freelancer dashboards', depth: 84, rateCeiling: 130, evidence: [], reasoning: 'Dashboard delivery evidence.', tags: ['React'], accepted: false },
    ],
    leads: [
      {
        id: 'l1',
        status: 'new',
        score: 92,
        source: 'hn',
        company: { name: 'VectorForge Labs', stack: ['React', 'Node'], size: '11-50', mission: 'AI workflow platform' },
        role: 'AI Workflow Engineer',
        rateRange: [125, 175],
        reasoning: ['Matches accepted niche'],
        draftMessage: { subject: 'VectorForge workflow MVP', body: 'Hi {{firstName}}, I noticed {{repo}} and can help scope the workflow MVP.', wordCount: 13, tokens: ['firstName', 'repo'] },
      },
    ],
  }
}

async function mockFreelancerApi(page, state) {
  await page.route(/\/auth\/me$/, async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: 'u1',
          name: 'Test User',
          email: 'test@example.com',
          role: 'freelancer',
          selectedPlan: 'solo',
          plan: 'solo',
          authProvider: 'github',
          githubUsername: 'test-user',
          capabilities: { agencyBrain: true, triProposal: true, freelancerOS: true },
        },
        currentWorkspace: null,
      },
    })
  })

  await page.route(/\/auth\/refresh$/, async (route) => {
    await route.fulfill({ json: { accessToken: 'mock-access', refreshToken: 'mock-refresh' } })
  })

  await page.route(/\/api\/freelancer\/flowboard$/, async (route) => {
    await route.fulfill({
      json: {
        profile,
        niches: state.niches,
        leads: state.leads,
        escrows: [{ id: 'e1', totalAmount: 8400, currency: 'USDC', milestones: [{ name: 'MVP workflow build', amount: 3600, status: 'locked' }] }],
        invoices: [],
        credentials: [],
        metrics: { nicheDepth: 91, qualifiedLeads: 1, averageLeadScore: 92, escrowBalance: 3600, reputationScore: 86, activeAgents: 3 },
        tasks: [{ id: 't1', label: 'Review high-score outreach draft', status: 'open' }],
      },
    })
  })

  await page.route(/\/api\/freelancer\/niches$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { niches: state.niches } })
      return
    }
    await route.continue()
  })

  await page.route(/\/api\/freelancer\/niches\/[^/]+$/, async (route) => {
    const id = route.request().url().split('/').pop()
    const body = route.request().postDataJSON()
    state.niches = state.niches.map((niche) => (niche.id === id ? { ...niche, accepted: body.accepted } : niche))
    await route.fulfill({ json: { niche: state.niches.find((niche) => niche.id === id) } })
  })

  await page.route(/\/api\/freelancer\/leads$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { leads: state.leads } })
      return
    }
    await route.continue()
  })

  await page.route(/\/api\/freelancer\/leads\/[^/]+$/, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fulfill({ json: { ok: true } })
      return
    }
    const parts = route.request().url().split('/')
    const id = parts[parts.length - 1]
    const body = route.request().postDataJSON()
    state.leads = state.leads.map((lead) => (lead.id === id ? { ...lead, ...body } : lead))
    await route.fulfill({ json: { lead: state.leads.find((lead) => lead.id === id) } })
  })
}

async function authenticate(page, baseURL) {
  await page.goto(baseURL)
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'mock-access')
    localStorage.setItem('refreshToken', 'mock-refresh')
  })
}

test('protected freelancer route redirects anonymous users', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/freelancer`)
  await expect(page).toHaveURL(/\/login$/)
})

test('freelancer FlowBoard renders with mocked API data', async ({ page, baseURL }) => {
  const state = makeState()
  await mockFreelancerApi(page, state)
  await authenticate(page, baseURL)

  await page.goto(`${baseURL}/freelancer`)
  await expect(page.getByTestId('freelancer-flowboard')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'FlowBoard' })).toBeVisible()
  await expect(page.getByText('VectorForge Labs')).toBeVisible()
})

test('lead drag updates a pipeline status', async ({ page, baseURL }) => {
  const state = makeState()
  await mockFreelancerApi(page, state)
  await authenticate(page, baseURL)

  await page.goto(`${baseURL}/freelancer/leads`)
  await page.getByTestId('lead-card-l1').dragTo(page.getByTestId('lead-column-qualified'))
  await expect(page.getByTestId('lead-column-qualified').getByText('VectorForge Labs')).toBeVisible()
})

test('niche accept flow persists selected state', async ({ page, baseURL }) => {
  const state = makeState()
  await mockFreelancerApi(page, state)
  await authenticate(page, baseURL)

  await page.goto(`${baseURL}/freelancer/niches`)
  await page.getByTestId('accept-niche-n2').click()
  await expect(page.getByTestId('accept-niche-n2')).toContainText('Accepted')
})
