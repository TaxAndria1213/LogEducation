/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Inscription } from "../../../../generated/zod";
import { formatDateWithLocalTimezone } from "../../../../app/utils/functions";
import type {
  AnneeScolaire,
  ArretTransport,
  CatalogueFrais,
  Classe,
  FormuleCantine,
  LigneTransport,
  Remise,
} from "../../../../types/models";
import type { InscriptionScolarite } from "../../../../types/form";
import AnneeScolaireService from "../../../../services/anneeScolaire.service";
import ArretTransportService from "../../../../services/arretTransport.service";
import ClasseService from "../../../../services/classe.service";
import CatalogueFraisService, { isApprovedCatalogueFrais } from "../../../../services/catalogueFrais.service";
import FormuleCantineService from "../../../../services/formuleCantine.service";
import InscriptionService from "../../../../services/inscription.service";
import LigneTransportService, {
  getLigneTransportSettings,
} from "../../../../services/ligneTransport.service";
import RemiseService from "../../../../services/remise.service";
import ParentTuteurService from "../../../../services/parentTuteur.service";
import NiveauScolaireService from "../../../../services/niveau.service";

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
  classeOptions: Array<Option & { niveau_scolaire_id?: string | null }>;
  transportLineOptions: Array<
    Option & {
      catalogue_frais_id?: string | null;
      zones?: string[];
      inscriptions_ouvertes?: boolean;
    }
  >;
  transportStopOptions: Array<Option & { ligne_transport_id?: string | null }>;
  cantineFormulaOptions: Array<Option & { catalogue_frais_id?: string | null }>;
  catalogueFraisOptions: Array<
    Option & {
      montant: number;
      devise: string;
      nombre_tranches?: number;
      mode_facturation?: string | null;
      est_recurrent?: boolean;
      periodicite?: string | null;
      niveau_scolaire_id?: string | null;
      usage_scope?: string | null;
      plans_paiement_autorises_json?: unknown;
      plan_paiement_defaut_code?: string | null;
    }
  >;
  remiseOptions: Array<
    Option & {
      type: string;
      valeur: number;
    }
  >;
  parentTuteurOptions: Array<
    Option & {
      nom_complet?: string | null;
      prenom?: string | null;
      nom?: string | null;
      telephone?: string | null;
      telephone_secondaire?: string | null;
      email?: string | null;
      adresse?: string | null;
      profession?: string | null;
      lieu_travail?: string | null;
    }
  >;
  niveauOptions: Option[];
  anneeScolaireId: string | null;
  anneeScolaireLabel: string | null;

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
  catalogueFraisOptions: [],
  remiseOptions: [],
  parentTuteurOptions: [],
  niveauOptions: [],
  anneeScolaireId: null,
  anneeScolaireLabel: null,

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
          anneeScolaireLabel: null,
          classeOptions: [],
          transportLineOptions: [],
          transportStopOptions: [],
          cantineFormulaOptions: [],
          catalogueFraisOptions: [],
          remiseOptions: [],
          parentTuteurOptions: [],
          niveauOptions: [],
        });
        throw new Error("Aucune annee scolaire active n'est disponible.");
      }

      set({ anneeScolaireId: anneeScolaire.id, anneeScolaireLabel: anneeScolaire.nom ?? null });

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
      const niveauService = new NiveauScolaireService();
      const ligneTransportService = new LigneTransportService();
      const arretTransportService = new ArretTransportService();
      const formuleCantineService = new FormuleCantineService();
      const catalogueFraisService = new CatalogueFraisService();
      const remiseService = new RemiseService();
      const parentTuteurService = new ParentTuteurService();

      const [classes, niveaux, lignes, arrets, formules, catalogueFrais, remises, parentsTuteurs] = await Promise.all([
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
        niveauService.getAll({
          take: 1000,
          where: JSON.stringify({
            etablissement_id,
          }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
        }),
        ligneTransportService.getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({ arrets: true, frais: true }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        arretTransportService.getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({ ligne: true }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
        }),
        formuleCantineService.getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({ frais: true }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
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
        parentTuteurService.getAll({
          take: 1000,
          where: JSON.stringify({ etablissement_id }),
          includeSpec: JSON.stringify({
            utilisateur: {
              include: {
                profil: true,
              },
            },
          }),
          orderBy: JSON.stringify([{ nom_complet: "asc" }]),
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
                .join(" - "),
              niveau_scolaire_id: classe.niveau_scolaire_id ?? null,
            }))
          : [];

      const niveauOptions =
        niveaux?.status.success
          ? niveaux.data.data.map((niveau: { id: string; nom?: string | null }) => ({
              value: niveau.id,
              label: niveau.nom?.trim() || "Niveau",
            }))
          : [];

      const transportLineOptions =
        lignes?.status.success
          ? lignes.data.data.map(
              (
                ligne: LigneTransport & {
                  frais?: { nom?: string | null; montant?: number | null; devise?: string | null } | null;
                },
              ) => ({
                value: ligne.id,
                label: [
                  ligne.nom,
                  ligne.frais?.nom
                    ? `${ligne.frais.nom} (${Number(ligne.frais.montant ?? 0).toLocaleString("fr-FR")} ${ligne.frais.devise ?? "MGA"})`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" - "),
                catalogue_frais_id: ligne.catalogue_frais_id ?? null,
                zones: getLigneTransportSettings(ligne).zones,
                inscriptions_ouvertes: getLigneTransportSettings(ligne).inscriptions_ouvertes,
              }),
            )
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
                label: [arret.ligne?.nom, arret.nom].filter(Boolean).join(" - "),
                ligne_transport_id: arret.ligne_transport_id ?? null,
              }),
            )
          : [];

      const cantineFormulaOptions =
        formules?.status.success
          ? formules.data.data.map(
              (
                formule: FormuleCantine & {
                  frais?: { nom?: string | null; montant?: number | null; devise?: string | null } | null;
                },
              ) => ({
                value: formule.id,
                label: [
                  formule.nom,
                  formule.frais?.nom
                    ? `${formule.frais.nom} (${Number(formule.frais.montant ?? 0).toLocaleString("fr-FR")} ${formule.frais.devise ?? "MGA"})`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" - "),
                catalogue_frais_id: formule.catalogue_frais_id ?? null,
              }),
            )
          : [];

      const catalogueFraisOptions =
        catalogueFrais?.status.success
          ? catalogueFrais.data.data
            .filter((frais: CatalogueFrais) => isApprovedCatalogueFrais(frais))
            .map((frais: CatalogueFrais & {
              niveau?: { nom?: string | null } | null;
            }) => ({
              value: frais.id,
              label: [
                frais.nom,
                frais.niveau?.nom ? `Niveau ${frais.niveau.nom}` : null,
                `${Number(frais.montant ?? 0).toLocaleString("fr-FR")} ${frais.devise ?? "MGA"}`,
              ]
                .filter(Boolean)
                .join(" - "),
              montant: Number(frais.montant ?? 0),
              devise: frais.devise ?? "MGA",
              nombre_tranches: Number(frais.nombre_tranches ?? 1),
              mode_facturation: frais.mode_facturation ?? "PONCTUEL",
              est_recurrent: Boolean(frais.est_recurrent),
              periodicite: frais.periodicite ?? null,
              niveau_scolaire_id: frais.niveau_scolaire_id ?? null,
              usage_scope: frais.usage_scope ?? "GENERAL",
              plans_paiement_autorises_json: frais.plans_paiement_autorises_json ?? null,
              plan_paiement_defaut_code: frais.plan_paiement_defaut_code ?? null,
            }))
          : [];

      const remiseOptions =
        remises?.status.success
          ? remises.data.data.map((remise: Remise) => ({
              value: remise.id,
              label:
                remise.type?.toUpperCase() === "PERCENT"
                  ? `${remise.nom} - ${Number(remise.valeur ?? 0).toLocaleString("fr-FR")}%`
                  : `${remise.nom} - ${Number(remise.valeur ?? 0).toLocaleString("fr-FR")}`,
              type: remise.type ?? "FIXED",
              valeur: Number(remise.valeur ?? 0),
            }))
          : [];

      const parentTuteurOptions =
        parentsTuteurs?.status.success
          ? parentsTuteurs.data.data.map((parent: {
              id: string;
              nom_complet?: string | null;
              utilisateur?: {
                profil?: {
                  prenom?: string | null;
                  nom?: string | null;
                } | null;
              } | null;
              telephone?: string | null;
              telephone_secondaire?: string | null;
              email?: string | null;
              adresse?: string | null;
              profession?: string | null;
              lieu_travail?: string | null;
            }) => ({
              value: parent.id,
              label: [
                parent.nom_complet?.trim() || "Parent / tuteur",
                parent.telephone?.trim() || null,
                parent.email?.trim() || null,
              ]
                .filter(Boolean)
                .join(" - "),
              nom_complet: parent.nom_complet ?? null,
              prenom: parent.utilisateur?.profil?.prenom ?? null,
              nom: parent.utilisateur?.profil?.nom ?? null,
              telephone: parent.telephone ?? null,
              telephone_secondaire: parent.telephone_secondaire ?? null,
              email: parent.email ?? null,
              adresse: parent.adresse ?? null,
              profession: parent.profession ?? null,
              lieu_travail: parent.lieu_travail ?? null,
            }))
          : [];

      const today = toDateOnlyString(new Date());
      set({
        classeOptions,
        transportLineOptions,
        transportStopOptions,
        cantineFormulaOptions,
        catalogueFraisOptions,
        remiseOptions,
        parentTuteurOptions,
        niveauOptions,
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
      throw error;
    }
  },
}));
