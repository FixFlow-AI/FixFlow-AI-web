import { create } from 'zustand'

const useWorkspaceStore = create((set) => ({
  workspace: null,
  members: [],
  setWorkspace: (workspace) => set({ workspace }),
  setMembers: (members) => set({ members }),
  clearWorkspace: () => set({ workspace: null, members: [] }),
}))

export default useWorkspaceStore
