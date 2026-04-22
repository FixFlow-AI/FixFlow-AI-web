import { create } from 'zustand'

const initialStreamState = {
  isGenerating: false,
  parsedSections: {},
  streamBuffer: '',
  error: null,
  generatedProposalId: null,
}

const useProposalStore = create((set) => ({
  proposals: [],
  currentProposal: null,
  ...initialStreamState,

  setProposals: (proposals) => set({ proposals }),
  setCurrentProposal: (currentProposal) => set({ currentProposal }),
  startStream: () =>
    set({
      ...initialStreamState,
      isGenerating: true,
    }),
  appendStreamBuffer: (chunk) =>
    set((state) => ({
      streamBuffer: state.streamBuffer + chunk,
    })),
  setParsedSections: (parsedSections) => set({ parsedSections }),
  finishStream: (generatedProposalId) =>
    set({
      generatedProposalId,
      isGenerating: false,
    }),
  setStreamError: (error) =>
    set({
      error,
      isGenerating: false,
    }),
  resetStream: () => set(initialStreamState),
}))

export default useProposalStore
