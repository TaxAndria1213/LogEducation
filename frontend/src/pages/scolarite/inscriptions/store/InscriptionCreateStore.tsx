/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Inscription } from "../../../../generated/zod";
import { formatDateWithLocalTimezone } from "../../../../app/utils/functions";
import type {
  AnneeScolaire,
  ArretTransport,
  Classe,
  FormuleCantine,
  LigneTransport,
} from "../../../../types/models";
import type { InscriptionScolarite } from "../../../../types/form";
import AnneeScolaireService from "../../../../services/anneeScolaire.service";
import ArretTransportService from "../../../../services/arretTransport.service";
import ClasseService from "../../../../services/classe.service";
import FormuleCantineService from "../../../../services/formuleCantine.service";
import InscriptionService from "../../../../services/inscription.service";
import LigneTransportService from "../../../../services/ligneTransport.service";

export type InscriptionCreateInput = Partial<Inscription>;
type Option = { value: string; label: string };

function toDateOnlyString(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

type State = {
  loading: boolean;
  inscription: InscriptionCreateInput | null;
  initialData: Partial<InscriptionCreateInput> | null;
  service: InscriptionService;

  scolariteInitialData: Partial<InscriptionScolarite> | null;
  classeOptions: Option[];
  transportLineOptions: Option[];
  transportStopOptions: Option[];
  cantineFormulaOptions: Option[];
  anneeScolaireId: string | null;

  onCreate: (inscription: InscriptionCreateInput) => Promise<any>;
  onCreateFull: (payload: any) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setInscription: (inscription: InscriptionCreateInput) => void;
  getInscriptionOptions: (etablissement_id: string) => Promise<void>;
  setInitialData: (inscription: Partial<Inscription>) => void;
};

export const useInscriptionCreateStore = create<State>((set, get) => ({
  inscription: null,
  service: new InscriptionService(),
  loading: false,
  initialData: null,
  scolariteInitialData: null,
  classeOptions: [],
  transportLineOptions: [],
  transportStopOptions: [],
  cantineFormulaOptions: [],
  anneeScolaireId: null,

  setLoading: (loading: boolean) => set({ loading }),

  getInscriptionOptions: async (etablissement_id: string) => {
    set({ loading: true });

    try {
      const anneeScolaireService = AnneeScolaireService;
      const anneeScolaire = (await anneeScolaireService.getCurrent(
        etablissement_id,
      )) as AnneeScolaire | null;

      if (!anneeScolaire?.id) {
        set({
          anneeScolaireId: null,
          classeOptions: [],
          transportLineOptions: [],
          transportStopOptions: [],
          cantineFormulaOptions: [],
        });
        throw new Error("Aucune annee scolaire active n'est disponible.");
      }

      set({ anneeScolaireId: anneeScolaire.id });

      const inscriptionService = new InscriptionService();
      const registeredNumber =
        (await inscriptionService.getStudentRegisteredNumberThisYear(
          anneeScolaire.id,
        )) ?? 0;

      const { annee } = formatDateWithLocalTimezone(
        anneeScolaire.date_debut.toString(),
      );
      const code = `E${annee}${(registeredNumber + 1).toString().padStart(4, "0")}`;

      const classeService = new ClasseService();
      const ligneTransportService = new LigneTransportService();
      const arretTransportService = new ArretTransportService();
      const formuleCantineService = new FormuleCantineService();

      const [classes, lignes, arrets, formules] = await Promise.all([
        classeService.getAll({
          take: 1000,
          where: JSON.stringify({
            etablissement_id,
            annee_scolaire_id: anneeScolaire.id,
          }),
          includeSpec: JSON.stringify({
            niveau: true,
            site: true,
          }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        ligneTransportService.getAll({
          take: 1000,
          where: JSON.stringify({ etablissement_id }),
          includeSpec: JSON.stringify({ arrets: true }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        arretTransportService.getAll({
          take: 1000,
          where: JSON.stringify({
            ligne: { etablissement_id },
          }),
          includeSpec: JSON.stringify({ ligne: true }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
        }),
        formuleCantineService.getAll({
          take: 1000,
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
      ]);

      const classeOptions =
        classes?.status.success
          ? classes.data.data.map((classe: Classe & {
              niveau?: { nom?: string | null } | null;
              site?: { nom?: string | null } | null;
            }) => ({
              value: classe.id,
              label: [classe.nom, classe.niveau?.nom, classe.site?.nom]
                .filter(Boolean)
                .join(" · "),
            }))
          : [];

      const transportLineOptions =
        lignes?.status.success
          ? lignes.data.data.map((ligne: LigneTransport) => ({
              value: ligne.id,
              label: ligne.nom,
            }))
          : [];

      const transportStopOptions =
        arrets?.status.success
          ? arrets.data.data.map(
              (
                arret: ArretTransport & {
                  ligne?: { nom?: string | null } | null;
                },
              ) => ({
                value: arret.id,
                label: [arret.ligne?.nom, arret.nom].filter(Boolean).join(" · "),
              }),
            )
          : [];

      const cantineFormulaOptions =
        formules?.status.success
          ? formules.data.data.map((formule: FormuleCantine) => ({
              value: formule.id,
              label: formule.nom,
            }))
          : [];

      const today = toDateOnlyString(new Date());
      set({
        classeOptions,
        transportLineOptions,
        transportStopOptions,
        cantineFormulaOptions,
        scolariteInitialData: {
          ...get().scolariteInitialData,
          code_eleve: code,
          date_entree: today,
          date_inscription: today,
          statut_inscription: "INSCRIT",
        },
      });
    } finally {
      set({ loading: false });
    }
  },

  setInitialData: (inscription: Partial<Inscription>) =>
    set({ initialData: inscription }),

  onCreate: async (inscription: InscriptionCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(inscription);
      if (result?.status.success) {
        return result;
      }
      throw new Error();
    } catch (error) {
      console.log("Erreur creation inscription :", error);
      return {
        status: {
          success: false,
        },
      };
    }
  },

  setInscription: (inscription: InscriptionCreateInput) =>
    set({ inscription }),

  onCreateFull: async (payload: any): Promise<any> => {
    try {
      const result = await get().service.createFull(payload);
      if (result?.status?.success) {
        return result;
      }
      throw new Error();
    } catch (error) {
      console.log("Erreur creation inscription complete :", error);
      return { status: { success: false } };
    }
  },
}));
