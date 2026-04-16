import { create } from "zustand";
import type {
  InitialisationCommitResult,
  InitialisationPreview,
} from "../types";

type State = {
  step: number;
  preview: InitialisationPreview | null;
  report: InitialisationCommitResult | null;
  setStep: (value: number) => void;
  setPreview: (value: InitialisationPreview | null) => void;
  setReport: (value: InitialisationCommitResult | null) => void;
  reset: () => void;
};

export const useInitialisationWizardStore = create<State>((set) => ({
  step: 0,
  preview: null,
  report: null,
  setStep: (value) => set({ step: value }),
  setPreview: (value) => set({ preview: value }),
  setReport: (value) => set({ report: value }),
  reset: () => set({ step: 0, preview: null, report: null }),
}));
