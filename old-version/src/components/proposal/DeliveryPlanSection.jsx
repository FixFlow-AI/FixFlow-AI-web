import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import NotificationPreferencesCard from '@/components/settings/NotificationPreferencesCard'
import { normalizeNotificationPreferences } from '@/lib/notificationPreferences'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'weekly', label: 'Weekly Plan' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'backlog', label: 'Backlog' },
]

function StatusBadge({ status }) {
  const variant = status === 'done'
    ? 'bg-emerald-400/16 text-emerald-200 border-emerald-300/30'
    : status === 'backlog'
      ? 'bg-amber-400/16 text-amber-200 border-amber-300/30'
      : 'bg-sky-400/16 text-sky-200 border-sky-300/30'

  return (
    <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]', variant)}>
      {status}
    </span>
  )
}

export default function DeliveryPlanSection({
  deliveryPlan,
  canEdit,
  isSaving = false,
  onSetTaskStatus,
  onMoveToBacklog,
  onRestoreBacklog,
  onSaveGoals,
  onSaveNotifications,
}) {
  const [activeTab, setActiveTab] = useState('weekly')
  const [goalDrafts, setGoalDrafts] = useState({})
  const [restoreTargets, setRestoreTargets] = useState({})

  useEffect(() => {
    const nextGoalDrafts = {}
    ;(deliveryPlan?.weeks || []).forEach((week) => {
      nextGoalDrafts[week.id] = [...week.goals]
    })
    setGoalDrafts(nextGoalDrafts)
  }, [deliveryPlan])

  const firstWeekId = deliveryPlan?.weeks?.[0]?.id || ''

  const restoreWeekIdByItem = useMemo(() => {
    const next = {}
    ;(deliveryPlan?.backlog || []).forEach((item) => {
      next[item.id] = restoreTargets[item.id] || firstWeekId
    })
    return next
  }, [deliveryPlan, firstWeekId, restoreTargets])

  if (!deliveryPlan) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background/30 text-muted-foreground hover:bg-muted'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'weekly' ? (
        <div className="space-y-4">
          {deliveryPlan.weeks.map((week) => (
            <div key={week.id} className="glass-card rounded-[28px] p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold">{week.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{week.sourcePhase}</p>
                </div>
                <div className="rounded-full border border-border bg-background/35 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Weeks {week.startWeek}-{week.endWeek}
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background/20 p-4">
                  <div className="text-sm font-semibold">Goals</div>
                  <div className="mt-3 space-y-3">
                    {canEdit ? [0, 1].map((index) => (
                      <input
                        key={index}
                        value={goalDrafts[week.id]?.[index] || ''}
                        onChange={(event) =>
                          setGoalDrafts((current) => ({
                            ...current,
                            [week.id]: Object.assign([...(current[week.id] || [])], { [index]: event.target.value }),
                          }))
                        }
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder={index === 0 ? 'Primary weekly goal' : 'Secondary weekly goal'}
                      />
                    )) : (
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {week.goals.map((goal) => (
                          <li key={goal} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
                            <span>{goal}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {canEdit ? (
                    <div className="mt-4 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSaveGoals?.(week.id, (goalDrafts[week.id] || []).filter(Boolean))}
                        isLoading={isSaving}
                      >
                        Save Goals
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border bg-background/20 p-4">
                  <div className="text-sm font-semibold">Tasks</div>
                  <div className="mt-3 space-y-3">
                    {week.tasks.length ? week.tasks.map((task) => (
                      <div key={task.id} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="font-medium">{task.title}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {task.owner} owner {task.notify ? '· notifications on' : ''}
                            </div>
                          </div>
                          <StatusBadge status={task.status} />
                        </div>
                        {canEdit ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {task.status !== 'done' ? (
                              <Button size="sm" variant="success" onClick={() => onSetTaskStatus?.(week.id, task.id, 'done')} isLoading={isSaving}>
                                Mark Done
                              </Button>
                            ) : null}
                            {task.status !== 'planned' ? (
                              <Button size="sm" variant="outline" onClick={() => onSetTaskStatus?.(week.id, task.id, 'planned')} isLoading={isSaving}>
                                Reopen
                              </Button>
                            ) : null}
                            <Button size="sm" variant="warning" onClick={() => onMoveToBacklog?.(week.id, task.id)} isLoading={isSaving}>
                              Move to Backlog
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-border bg-background/20 p-4 text-sm text-muted-foreground">
                        No active tasks left in this week.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background/20 p-4">
                  <div className="text-sm font-semibold">Deliverables</div>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {week.deliverables.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-border bg-background/20 p-4">
                  <div className="text-sm font-semibold">Dependencies</div>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {(week.dependencies || []).length ? week.dependencies.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
                        <span>{item}</span>
                      </li>
                    )) : (
                      <li>No blocking dependencies listed.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'roadmap' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {deliveryPlan.roadmap.map((milestone) => (
            <div key={milestone.id} className="glass-card rounded-[28px] p-6">
              <div className="text-xs uppercase tracking-[0.24em] text-primary">Roadmap milestone</div>
              <h3 className="mt-3 text-xl font-semibold">{milestone.title}</h3>
              <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                <span>Target week {milestone.targetWeek}</span>
                <StatusBadge status={milestone.status} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'backlog' ? (
        <div className="space-y-4">
          {deliveryPlan.backlog.length ? deliveryPlan.backlog.map((item) => (
            <div key={item.id} className="glass-card rounded-[28px] p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Reason: {item.reason.replace(/_/g, ' ')}
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>

              {canEdit && deliveryPlan.weeks.length ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    value={restoreWeekIdByItem[item.id] || firstWeekId}
                    onChange={(event) =>
                      setRestoreTargets((current) => ({ ...current, [item.id]: event.target.value }))
                    }
                    className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
                  >
                    {deliveryPlan.weeks.map((week) => (
                      <option key={week.id} value={week.id}>
                        Restore to {week.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={() => onRestoreBacklog?.(item.id, restoreWeekIdByItem[item.id] || firstWeekId)}
                    isLoading={isSaving}
                  >
                    Restore to Timeline
                  </Button>
                </div>
              ) : null}
            </div>
          )) : (
            <div className="glass-card rounded-[28px] p-6 text-sm text-muted-foreground">
              No overflow items are currently sitting in backlog.
            </div>
          )}
        </div>
      ) : null}

      <NotificationPreferencesCard
        title="Delivery Plan Notifications"
        description="Keep collaboration alerts aligned with this delivery plan when goals close, work moves to backlog, or assignments change."
        value={normalizeNotificationPreferences(deliveryPlan.notificationDefaults)}
        onSave={onSaveNotifications}
        isSaving={isSaving}
        disabled={!canEdit}
      />
    </div>
  )
}
