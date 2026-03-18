import { create } from "zustand";
import type { CreneauFormInput } from "../types";

type State = {
  loading: boolean;
  initialValues: Partial<CreneauFormInput> | null;
  setLoading: (loading: boolean) => void;
  setInitialValues: (values: Partial<CreneauFormInput>) => void;
};

export const useCreneauHoraireCreateStore = create<State>((set) => ({
  loading: false,
  initialValues: null,
  setLoading: (loading: boolean) => set({ loading }),
  setInitialValues: (values: Partial<CreneauFormInput>) =>
    set({ initialValues: values }),
}));
