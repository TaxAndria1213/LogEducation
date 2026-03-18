/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Profil, Utilisateur } from "../../../../generated/zod";
import ProfileService from "../../../../services/profile.service";
import UtilisateurService from "../../../../services/utilisateur.service";

export type ProfileCreateInput = Omit<Profil, "id" | "created_at" | "updated_at">;

type Option = { value: string; label: string };

type State = {
  loading: boolean;
  profile: ProfileCreateInput | null;
  initialValues: Partial<ProfileCreateInput> | null;
  service: ProfileService;
  utilisateurOptions: Option[];
  onCreate: (profile: ProfileCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setProfile: (profile: ProfileCreateInput) => void;
  getUtilisateurOptions: (etablissementId?: string | null) => Promise<void>;
  setInitialValues: (profile: Partial<Profil>) => void;
};

export const useProfileCreateStore = create<State>((set, get) => ({
  profile: null,
  service: new ProfileService(),
  utilisateurOptions: [],
  loading: false,
  initialValues: null,

  setLoading: (loading: boolean) => set({ loading }),

  getUtilisateurOptions: async (etablissementId?: string | null) => {
    if (!etablissementId) {
      set({ utilisateurOptions: [], loading: false });
      return;
    }

    set({ loading: true });
    const utilisateurService = new UtilisateurService();
    const result = await utilisateurService.getAll({
      take: 1000,
      where: JSON.stringify({
        etablissement_id: etablissementId,
        profil: { is: null },
      }),
      orderBy: JSON.stringify([{ email: "asc" }]),
    });

    if (result?.status.success) {
      set({
        utilisateurOptions: result.data.data.map((user: Utilisateur) => ({
          value: user.id,
          label:
            [user.email, user.telephone].filter(Boolean).join(" - ") ||
            `Utilisateur ${user.id.slice(0, 8)}`,
        })),
      });
    } else {
      throw new Error("Failed to load utilisateur options");
    }

    set({ loading: false });
  },

  setInitialValues: (profile: Partial<Profil>) => set({ initialValues: profile }),

  onCreate: async (profile: ProfileCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(profile);
      if (result?.status.success) {
        return result;
      }

      throw new Error();
    } catch (error) {
      console.log("Profile create error:", error);
      return {
        status: {
          success: false,
        },
      };
    }
  },

  setProfile: (profile: ProfileCreateInput) => set({ profile }),
}));
