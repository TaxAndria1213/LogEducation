import { create } from "zustand";

interface PageState {
    menuState: boolean
}

export const usePageStore = create<PageState>()(
    (set) => ({
        menuState: false,
        toggleMenu: () => set((state) => ({ menuState: !state.menuState })),
    })

)