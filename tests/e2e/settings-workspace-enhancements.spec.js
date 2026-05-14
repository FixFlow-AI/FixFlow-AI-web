import { test, expect } from '@playwright/test'

const ALL_PERMISSIONS = [
  'workspace.view',
  'workspace.settings.manage',
  'members.invite',
  'members.remove',
  'members.role.assign',
  'roles.manage',
  'proposals.create',
  'proposals.edit',
  'proposals.comment',
  'proposals.share',
  'freelancer.view',
  'freelancer.manage',
  'slack.manage',
  'notifications.manage',
]

function makeWorkspaceState(permissions = ALL_PERMISSIONS) {
  const roles = [
    { roleId: 'owner', name: 'Owner', permissions: ALL_PERMISSIONS, system: true },
    { roleId: 'editor', name: 'Editor', permissions: ['workspace.view', 'proposals.create', 'proposals.edit'], system: true },
    { roleId: 'viewer', name: 'Viewer', permissions: ['workspace.view'], system: true },
  ]

  const members = [
    {
      userId: 'u1',
      name: 'Test Owner',
      email: 'owner@example.com',
      role: permissions.includes('roles.manage') ? 'owner' : 'viewer',
      roleName: permissions.includes('roles.manage') ? 'Owner' : 'Viewer',
      permissions,
    },
    {
      userId: 'u2',
      name: 'Riya Editor',
      email: 'riya@example.com',
      role: 'editor',
      roleName: 'Editor',
      permissions: ['workspace.view', 'proposals.create', 'proposals.edit'],
    },
  ]

  return {
    workspace: {
      id: 'w1',
      name: 'FixFlow Studio',
      currentUserRole: members[0].role,
      currentUserRoleName: members[0].roleName,
      permissions,
      notificationDefaults: {
        channels: ['in_app', 'slack'],
        events: ['workspace_invite', 'proposal_comment', 'freelancer_lead'],
      },
    },
    fullWorkspace: {
      id: 'w1',
      name: 'FixFlow Studio',
      roles,
      members,
      invites: [],
      notificationDefaults: {
        channels: ['in_app', 'slack'],
        events: ['workspace_invite', 'proposal_comment', 'freelancer_lead'],
      },
    },
  }
}

async function authenticate(page, userOverrides = {}, currentWorkspace = null) {
  const user = {
    id: 'u1',
    name: 'Test Owner',
    email: 'owner@example.com',
    avatar: '/avatar.png',
    plan: 'pro',
    defaultEntryMode: currentWorkspace ? 'team' : 'individual',
    capabilities: { agencyBrain: true, triProposal: true },
    notificationPreferences: {
      channels: ['in_app', 'email'],
      events: ['workspace_invite', 'proposal_comment'],
    },
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
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      Object.assign(user, body)
      await route.fulfill({ json: { user, currentWorkspace } })
      return
    }

    await route.fulfill({ json: { user, currentWorkspace } })
  })

  await page.route('**/api/notifications**', async (route) => {
    await route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })

  return user
}

async function mockWorkspaceApi(page, state, slackState = { connected: false, status: 'disconnected' }) {
  await page.route('**/api/workspaces/current', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      state.workspace.notificationDefaults = body.notificationDefaults || state.workspace.notificationDefaults
      state.fullWorkspace.notificationDefaults = state.workspace.notificationDefaults
    }

    await route.fulfill({ json: state })
  })

  await page.route('**/api/workspaces/current/roles', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ json: { roles: state.fullWorkspace.roles } })
      return
    }

    const body = route.request().postDataJSON()
    const role = {
      roleId: body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name: body.name,
      permissions: body.permissions,
      system: false,
    }
    state.fullWorkspace.roles.push(role)
    await route.fulfill({ json: { role, roles: state.fullWorkspace.roles } })
  })

  await page.route('**/api/workspaces/current/members/*/role', async (route) => {
    const body = route.request().postDataJSON()
    const memberId = route.request().url().split('/members/')[1].split('/role')[0]
    const nextRole = state.fullWorkspace.roles.find((role) => role.roleId === body.role)
    state.fullWorkspace.members = state.fullWorkspace.members.map((member) => (
      member.userId === memberId
        ? { ...member, role: body.role, roleName: nextRole?.name || body.role, permissions: nextRole?.permissions || [] }
        : member
    ))
    await route.fulfill({ json: { member: state.fullWorkspace.members.find((member) => member.userId === memberId) } })
  })

  await page.route('**/api/integrations/slack/status', async (route) => {
    await route.fulfill({ json: { slack: slackState } })
  })

  await page.route('**/api/integrations/slack/test', async (route) => {
    slackState.lastDeliveryStatus = 'sent'
    await route.fulfill({ json: { slack: slackState } })
  })

  await page.route('**/api/integrations/slack', async (route) => {
    if (route.request().method() === 'DELETE') {
      Object.assign(slackState, { connected: false, status: 'disconnected', teamName: '', channelName: '' })
      await route.fulfill({ json: { slack: slackState } })
      return
    }

    await route.fallback()
  })
}

test('theme-aware 3D backdrop stays mounted and avatar upload commits through the mocked S3 flow', async ({ page, baseURL }) => {
  const uploadUrl = `${baseURL}/mock-s3/avatar.png`
  let uploadCommitted = false

  await authenticate(page)
  await page.route('**/api/auth/avatar/upload-url', async (route) => {
    await route.fulfill({
      json: {
        uploadUrl,
        fileKey: 'avatars/u1/123.png',
        avatarUrl: '/api/auth/avatar/u1/123.png',
        maxSize: 2 * 1024 * 1024,
      },
    })
  })
  await page.route('**/mock-s3/avatar.png', async (route) => {
    await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' })
  })
  await page.route('**/api/auth/avatar/commit', async (route) => {
    uploadCommitted = true
    await route.fulfill({
      json: {
        user: {
          id: 'u1',
          name: 'Test Owner',
          email: 'owner@example.com',
          avatar: '/api/auth/avatar/u1/123.png',
          avatarKey: 'avatars/u1/123.png',
        },
      },
    })
  })

  await page.goto(`${baseURL}/settings`)
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  const backdrop = page.getByTestId('workspace-backdrop')
  await expect(backdrop).toBeAttached()
  await expect(page.locator('canvas').first()).toBeVisible()

  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/theme-light/)
  const lightColor = await backdrop.evaluate((element) => getComputedStyle(element).getPropertyValue('--backdrop-primary').trim())

  await page.getByRole('button', { name: 'Modern Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/theme-modern-dark/)
  const modernDarkColor = await backdrop.evaluate((element) => getComputedStyle(element).getPropertyValue('--backdrop-primary').trim())

  await page.getByRole('button', { name: 'VS Code Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/theme-vscode-dark/)
  const vscodeDarkColor = await backdrop.evaluate((element) => getComputedStyle(element).getPropertyValue('--backdrop-primary').trim())

  expect(new Set([lightColor, modernDarkColor, vscodeDarkColor]).size).toBe(3)

  await page.getByTestId('avatar-upload-input').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFgwJ/lN4MxwAAAABJRU5ErkJggg==',
      'base64',
    ),
  })
  await expect(page.getByAltText('Uploaded avatar preview')).toBeVisible()
  await page.getByRole('button', { name: /Save Changes/ }).click()
  await expect.poll(() => uploadCommitted).toBe(true)
})

test('workspace owner creates a custom role, assigns it, and manages Slack delivery', async ({ page, baseURL }) => {
  const state = makeWorkspaceState()
  const slackState = {
    connected: true,
    status: 'connected',
    teamName: 'FixFlow Labs',
    channelName: '#ship-room',
  }

  await authenticate(page, {}, state.workspace)
  await mockWorkspaceApi(page, state, slackState)

  await page.goto(`${baseURL}/workspace/settings`)
  await expect(page.getByTestId('workspace-role-manager')).toBeVisible()
  await expect(page.getByTestId('slack-integration-card')).toContainText('FixFlow Labs')

  await page.getByPlaceholder('Delivery QA').fill('Delivery QA')
  await page.getByLabel('Manage Freelancer OS').last().check()
  await page.getByRole('button', { name: /Add Role/ }).click()
  await expect(page.getByTestId('workspace-role-manager')).toContainText('delivery-qa')

  const memberRow = page.locator('div').filter({ hasText: 'Riya Editor' }).filter({ has: page.locator('select') }).first()
  await memberRow.locator('select').selectOption('delivery-qa')
  await expect(memberRow).toContainText('Delivery QA')

  await page.getByRole('button', { name: /Send Test/ }).click()
  await expect.poll(() => slackState.lastDeliveryStatus).toBe('sent')
  await page.getByRole('button', { name: /Disconnect/ }).click()
  await expect(page.getByTestId('slack-integration-card')).toContainText('disconnected')
})

test('limited workspace role cannot access owner-only workspace actions', async ({ page, baseURL }) => {
  const state = makeWorkspaceState(['workspace.view'])
  await authenticate(page, {}, state.workspace)
  await mockWorkspaceApi(page, state, { connected: false, status: 'disconnected' })

  await page.goto(`${baseURL}/workspace/settings`)

  await expect(page.getByRole('button', { name: /Invite Member/ })).toBeDisabled()
  await expect(page.getByTestId('workspace-role-manager')).toContainText('Owner permission required')
  await expect(page.getByPlaceholder('Delivery QA')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Connect Slack/ })).toBeDisabled()
})
