import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import api from '@/config/api'

const PERMISSION_LABELS = {
  'workspace.view': 'View workspace',
  'workspace.settings.manage': 'Manage workspace settings',
  'members.invite': 'Invite members',
  'members.remove': 'Remove members',
  'members.role.assign': 'Assign roles',
  'roles.manage': 'Manage roles',
  'proposals.create': 'Create proposals',
  'proposals.edit': 'Edit proposals',
  'proposals.comment': 'Comment on proposals',
  'proposals.share': 'Share proposals',
  'freelancer.view': 'View Freelancer OS',
  'freelancer.manage': 'Manage Freelancer OS',
  'slack.manage': 'Manage Slack',
  'notifications.manage': 'Manage notifications',
}

function normalizeDraft(permissions = []) {
  return new Set(Array.isArray(permissions) ? permissions : [])
}

export default function RoleManager({ roles = [], permissions = [], canManage = false, onChanged }) {
  const [draftName, setDraftName] = useState('')
  const [draftPermissions, setDraftPermissions] = useState(() => new Set(['workspace.view']))
  const [busyRoleId, setBusyRoleId] = useState('')

  const groupedPermissions = useMemo(() => permissions.filter((permission) => permission !== 'workspace.view'), [permissions])

  const toggleDraftPermission = (permission) => {
    setDraftPermissions((current) => {
      const next = new Set(current)
      if (next.has(permission)) {
        next.delete(permission)
      } else {
        next.add(permission)
      }
      next.add('workspace.view')
      return next
    })
  }

  const createRole = async () => {
    if (!draftName.trim()) {
      toast.error('Role name is required.')
      return
    }

    setBusyRoleId('new')
    try {
      await api.post('/workspaces/current/roles', {
        name: draftName,
        permissions: [...draftPermissions],
      })
      setDraftName('')
      setDraftPermissions(new Set(['workspace.view']))
      toast.success('Role created.')
      onChanged?.()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to create role.')
    } finally {
      setBusyRoleId('')
    }
  }

  const updateRole = async (role, nextPermissions) => {
    setBusyRoleId(role.roleId)
    try {
      await api.patch(`/workspaces/current/roles/${role.roleId}`, {
        permissions: [...nextPermissions],
      })
      toast.success('Role updated.')
      onChanged?.()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update role.')
    } finally {
      setBusyRoleId('')
    }
  }

  const deleteRole = async (role) => {
    setBusyRoleId(role.roleId)
    try {
      await api.delete(`/workspaces/current/roles/${role.roleId}`)
      toast.success('Role deleted.')
      onChanged?.()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to delete role.')
    } finally {
      setBusyRoleId('')
    }
  }

  return (
    <div className="glass-card rounded-[28px] p-6" data-testid="workspace-role-manager">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Custom roles</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start from FixFlowAI defaults, then add owner-managed role templates for collaboration.
          </p>
        </div>
          <div className="surface-frame inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          {canManage ? 'Role manager active' : 'Owner permission required'}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {roles.map((role) => {
          const rolePermissions = normalizeDraft(role.permissions)
          return (
            <div key={role.roleId} className="surface-frame rounded-2xl border border-border bg-background/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{role.name}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {role.system ? 'Default' : role.roleId}
                  </div>
                </div>
                {!role.system && canManage ? (
                  <button
                    type="button"
                    onClick={() => deleteRole(role)}
                    disabled={busyRoleId === role.roleId}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                    aria-label={`Delete ${role.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-2">
                {permissions.map((permission) => (
                  <label key={permission} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={rolePermissions.has(permission)}
                      disabled={!canManage || role.system || permission === 'workspace.view' || busyRoleId === role.roleId}
                      onChange={() => {
                        const next = normalizeDraft(role.permissions)
                        if (next.has(permission)) next.delete(permission)
                        else next.add(permission)
                        next.add('workspace.view')
                        updateRole(role, next)
                      }}
                    />
                    <span>{PERMISSION_LABELS[permission] || permission}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {canManage ? (
      <div className="surface-frame mt-6 rounded-2xl border border-dashed border-border bg-background/25 p-4">
          <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr_auto] lg:items-start">
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Delivery QA"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {groupedPermissions.map((permission) => (
                <label key={permission} className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draftPermissions.has(permission)}
                    onChange={() => toggleDraftPermission(permission)}
                  />
                  <span>{PERMISSION_LABELS[permission] || permission}</span>
                </label>
              ))}
            </div>
            <Button onClick={createRole} isLoading={busyRoleId === 'new'}>
              <Plus className="h-4 w-4" />
              Add Role
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
