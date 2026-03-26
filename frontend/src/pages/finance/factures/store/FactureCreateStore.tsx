import { create } from "zustand";
import type { AnneeScolaire, Eleve } from "../../../../types/models";
import AnneeScolaireService from "../../../../services/anneeScolaire.service";
import EleveService from "../../../../services/eleve.service";
import CatalogueFraisService, {
  getCatalogueFraisDisplayLabel,
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../services/catalogueFrais.service";
import RemiseService from "../../../../services/remise.service";

type Option = { value: string; label: string };
type EleveOption = Option & {
  niveauxParAnnee?: Record<string, string>;
};

type State = {
  loading: boolean;
  errorMessage: string;
  anneeScolaireOptions: Option[];
  eleveOptions: EleveOption[];
  catalogueFraisOptions: Array<
    Option & {
      montant?: number;
      devise?: string | null;
      niveau_scolaire_id?: string | null;
    }
  >;
  remiseOptions: Array<
    Option & {
      type?: string | null;
      valeur?: number;
    }
  >;
  initialData: {
    etablissement_id?: string;
    annee_scolaire_id?: string;
    devise?: string;
    remise_id?: string;
    lignes?: Array<{
      catalogue_frais_id: string;
      libelle: string;
      quantite: number;
      prix_unitaire: number;
      montant: number;
    }>;
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

export const useFactureCreateStore = create<State>((set) => ({
  loading: false,
  errorMessage: "",
  anneeScolaireOptions: [],
  eleveOptions: [],
  catalogueFraisOptions: [],
  remiseOptions: [],
  initialData: null,
  getOptions: async (etablissement_id: string) => {
    set({ loading: true, errorMessage: "" });
    try {
      const eleveService = new EleveService();
      const catalogueFraisService = new CatalogueFraisService();
      const remiseService = new RemiseService();

      const [anneesResult, elevesResult, fraisResult, remisesResult, currentYear] = await Promise.all([
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
            inscriptions: {
              include: {
                classe: true,
              },
            },
          }),
          orderBy: JSON.stringify([{ code_eleve: "asc" }, { created_at: "desc" }]),
        }),
        catalogueFraisService.getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({ niveau: true }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        remiseService.getForEtablissement(etablissement_id, {
          take: 1000,
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        AnneeScolaireService.getCurrent(etablissement_id),
      ]);

      set({
        initialData: {
          etablissement_id,
          annee_scolaire_id: currentYear?.id ?? "",
          devise: "MGA",
          remise_id: "",
          lignes: [],
        },
      });

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
                inscriptions?: Array<{
                  annee_scolaire_id?: string | null;
                  classe?: { niveau_scolaire_id?: string | null } | null;
                }> | null;
              },
            ) => ({
              value: item.id,
              label: buildEleveLabel(item),
              niveauxParAnnee: (item.inscriptions ?? []).reduce<Record<string, string>>(
                (acc, inscription) => {
                  if (
                    inscription?.annee_scolaire_id &&
                    inscription?.classe?.niveau_scolaire_id
                  ) {
                    acc[inscription.annee_scolaire_id] = inscription.classe.niveau_scolaire_id;
                  }
                  return acc;
                },
                {},
              ),
            }),
          ),
        });
      }

      if (fraisResult?.status.success) {
        set({
          catalogueFraisOptions: fraisResult.data.data.map((item: CatalogueFraisWithRelations) => ({
            value: item.id,
            label: `${getCatalogueFraisDisplayLabel(item)} - ${getCatalogueFraisSecondaryLabel(item)}`,
            montant: Number(item.montant ?? 0),
            devise: item.devise ?? "MGA",
            niveau_scolaire_id: item.niveau_scolaire_id ?? null,
          })),
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
    } catch {
      set({
        errorMessage: "Impossible de charger les ressources du module Factures.",
      });
    } finally {
      set({ loading: false });
    }
  },
}));
