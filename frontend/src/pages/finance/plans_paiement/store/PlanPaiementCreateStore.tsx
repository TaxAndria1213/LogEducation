import { create } from "zustand";
import type { AnneeScolaire, Eleve } from "../../../../types/models";
import AnneeScolaireService from "../../../../services/anneeScolaire.service";
import EleveService from "../../../../services/eleve.service";
import RemiseService from "../../../../services/remise.service";

type Option = { value: string; label: string };

type State = {
  loading: boolean;
  errorMessage: string;
  anneeScolaireOptions: Option[];
  eleveOptions: Option[];
  remiseOptions: Array<Option & { type?: string | null; valeur?: number }>;
  initialData: {
    eleve_id?: string;
    annee_scolaire_id?: string;
    devise?: string;
    remise_id?: string;
  } | null;
  getOptions: (etablissement_id: string) => Promise<void>;
};

function buildEleveLabel(
  eleve: Eleve & {
    utilisateur?: {
      profil?: {
        prenom?: string | null;
        nom?: string | null;
      } | null;
    } | null;
  },
) {
  const prenom = eleve.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = eleve.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();
  if (fullName && eleve.code_eleve) return `${fullName} (${eleve.code_eleve})`;
  return fullName || eleve.code_eleve || "Eleve";
}

export const usePlanPaiementCreateStore = create<State>((set) => ({
  loading: false,
  errorMessage: "",
  anneeScolaireOptions: [],
  eleveOptions: [],
  remiseOptions: [],
  initialData: null,
  getOptions: async (etablissement_id: string) => {
    set({ loading: true, errorMessage: "" });
    try {
      const eleveService = new EleveService();
      const remiseService = new RemiseService();
      const [anneesResult, elevesResult, remisesResult, currentYear] = await Promise.all([
        AnneeScolaireService.getAll({
          take: 100,
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ date_debut: "desc" }]),
        }),
        eleveService.getAll({
          take: 1000,
          where: JSON.stringify({ etablissement_id }),
          includeSpec: JSON.stringify({
            utilisateur: { include: { profil: true } },
          }),
          orderBy: JSON.stringify([{ code_eleve: "asc" }, { created_at: "desc" }]),
        }),
        remiseService.getForEtablissement(etablissement_id, {
          take: 1000,
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        AnneeScolaireService.getCurrent(etablissement_id),
      ]);

      if (anneesResult?.status.success) {
        set({
          anneeScolaireOptions: anneesResult.data.data.map((item: AnneeScolaire) => ({
            value: item.id,
            label: item.nom,
          })),
        });
      }

      if (elevesResult?.status.success) {
        set({
          eleveOptions: elevesResult.data.data.map(
            (
              item: Eleve & {
                utilisateur?: {
                  profil?: {
                    prenom?: string | null;
                    nom?: string | null;
                  } | null;
                } | null;
              },
            ) => ({
              value: item.id,
              label: buildEleveLabel(item),
            }),
          ),
        });
      }

      if (remisesResult?.status.success) {
        set({
          remiseOptions: remisesResult.data.data.map(
            (item: { id: string; nom: string; type?: string | null; valeur?: number | string | null }) => ({
              value: item.id,
              label:
                (item.type ?? "").toUpperCase() === "PERCENT"
                  ? `${item.nom} - ${Number(item.valeur ?? 0).toLocaleString("fr-FR")}%`
                  : `${item.nom} - ${Number(item.valeur ?? 0).toLocaleString("fr-FR")}`,
              type: item.type ?? null,
              valeur: Number(item.valeur ?? 0),
            }),
          ),
        });
      }

      set({
        initialData: {
          annee_scolaire_id: currentYear?.id ?? "",
          devise: "MGA",
          remise_id: "",
        },
      });
    } catch {
      set({
        errorMessage: "Impossible de charger les ressources du module Plans de paiement.",
      });
    } finally {
      set({ loading: false });
    }
  },
}));
