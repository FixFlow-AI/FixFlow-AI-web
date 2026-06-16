import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAgencyBrainStore = create(
  persist(
    (set, get) => ({
      enabledInsights: {},
      setInsightEnabled: (id, enabled) =>
        set((state) => ({
          enabledInsights: {
            ...state.enabledInsights,
            [id]: enabled,
          },
        })),
      hydrateInsights: (insights = []) =>
        set((state) => {
          const next = { ...state.enabledInsights }
          insights.forEach((insight) => {
            if (next[insight.id] === undefined) {
              next[insight.id] = true
            }
          })
          return { enabledInsights: next }
        }),
      buildCalibrationContext: (insights = []) =>
        insights
          .filter((insight) => get().enabledInsights[insight.id] !== false)
          .map((insight) => `- ${insight.calibrationText}`)
          .join('\n'),
    }),
    {
      name: 'fixflowai-agency-brain',
    }
  )
)

export default useAgencyBrainStore
