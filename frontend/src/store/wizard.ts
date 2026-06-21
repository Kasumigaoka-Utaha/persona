import { create } from 'zustand'

export type JuryDraft = {
  documentTitle: string
  documentContent: string
  selectedAudienceKeys: string[]
  manualMode: boolean
}

type JuryState = {
  draft: JuryDraft
  setDraft: (patch: Partial<JuryDraft>) => void
  reset: () => void
}

const defaultDraft: JuryDraft = {
  documentTitle: '',
  documentContent: '',
  selectedAudienceKeys: [],
  manualMode: false,
}

export const useWizardStore = create<JuryState>((set) => ({
  draft: defaultDraft,
  setDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  reset: () => set({ draft: defaultDraft }),
}))
