import { create } from "zustand";
import type { Bulletin, Inscription, Periode } from "../../../../types/models";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import BulletinService from "../../../../services/bulletin.service";
import InscriptionService from "../../../../services/inscription.service";
import PeriodeService from "../../../../services/periode.service";
import { getEleveDisplayLabel, type EleveWithRelations } from "../../../../services/note.service";

export type BulletinCreateInput = Omit<
  Bulletin,
  "id" | "created_at" | "updated_at" | "classe_id"
>;

type InscriptionWithRelations = Inscription & {
  eleve?: EleveWithRelations | null;
  classe?: {
    id: string;
    nom?: string | null;
  } | null;
};

type SelectOption = {
  value: string;
  label: string;
};

type State = {
  loading: boolean;
  errorMessage: string;
  initialData: Partial<BulletinCreateInput> | null;
  eleveOptions: SelectOption[];
  periodeOptions: SelectOption[];
  inscriptions: InscriptionWithRelations[];
  periodes: Periode[];
  setLoading: (loading: boolean) => void;
  getOptions: (etablissement_id: string) => Promise<void>;
};

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return "Impossible de charger les ressources du module Bulletins.";
}

export const useBulletinCreateStore = create<State>((set) => ({
  loading: false,
  errorMessage: "",
  initialData: null,
  eleveOptions: [],
  periodeOptions: [],
  inscriptions: [],
  periodes: [],

  setLoading: (loading: boolean) => set({ loading }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true, errorMessage: "" });

    try {
      const currentYear = await anneeScolaireService.getCurrent(etablissement_id);

      if (!currentYear) {
        set({
          loading: false,
          initialData: {
            statut: "EN_COURS",
          },
          eleveOptions: [],
          periodeOptions: [],
          inscriptions: [],
          periodes: [],
          errorMessage:
            "Aucune annee scolaire active n'a ete trouvee pour preparer un bulletin.",
        });
        return;
      }

      const inscriptionService = new InscriptionService();

      const [inscriptionResult, periodeResult] = await Promise.all([
        inscriptionService.getAll({
          take: 1000,
          where: JSON.stringify({
            annee_scolaire_id: currentYear.id,
            classe: {
              etablissement_id,
            },
          }),
          includeSpec: JSON.stringify({
            eleve: {
              include: {
                utilisateur: {
                  include: {
                    profil: true,
                  },
                },
              },
            },
            classe: true,
          }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        }),
        PeriodeService.getAll({
          take: 200,
          where: JSON.stringify({
            annee_scolaire_id: currentYear.id,
          }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { date_debut: "asc" }]),
        }),
      ]);

      const inscriptions = inscriptionResult?.status.success
        ? ((inscriptionResult.data.data as InscriptionWithRelations[]) ?? [])
        : [];
      const periodes = periodeResult?.status.success
        ? ((periodeResult.data.data as Periode[]) ?? [])
        : [];

      set({
        loading: false,
        errorMessage: "",
        initialData: {
          statut: "EN_COURS",
          publie_le: null,
        },
        eleveOptions: inscriptions.map((item) => ({
          value: item.eleve_id,
          label: `${getEleveDisplayLabel(item.eleve)}${item.classe?.nom ? ` - ${item.classe.nom}` : ""}`,
        })),
        periodeOptions: periodes.map((item) => ({
          value: item.id,
          label: item.nom,
        })),
        inscriptions,
        periodes,
      });
    } catch (error: unknown) {
      set({
        loading: false,
        errorMessage: getErrorMessage(error),
        eleveOptions: [],
        periodeOptions: [],
        inscriptions: [],
        periodes: [],
      });
    }
  },
}));

