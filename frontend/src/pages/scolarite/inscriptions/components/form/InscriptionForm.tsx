/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCreditCard,
  FiMapPin,
  FiShield,
  FiTruck,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { z } from "zod";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import {
  MultiStepFormWizard,
  type WizardStep,
} from "../../../../../components/Form/multistep/MultiStepFormWizard";
import { ProfilSchema } from "../../../../../generated/zod";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import ReferencielService, {
  buildReferentialOptions,
  type ReferentialCatalogItem,
} from "../../../../../services/referenciel.service";
import type { StatutInscription } from "../../../../../types/models";
import { useInscriptionCreateStore } from "../../store/InscriptionCreateStore";

type WizardData = {
  eleve?: any;
  scolarite?: any;
  tuteur1?: any;
  tuteur2?: any;
  services?: any;
  finance?: any;
  echeancier?: any;
};

type CatalogueFeeOption = {
  value: string;
  label: string;
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
};

type CataloguePaymentPlan = {
  code: string;
  label: string;
  nombre_tranches: number;
  offsets_mois: number[];
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseBooleanLabel(value?: boolean) {
  return value ? "Oui" : "Non";
}

function matchesFeeScope(option: CatalogueFeeOption, scopes: string[]) {
  const scope = (option.usage_scope ?? "GENERAL").toUpperCase();
  return scopes.includes(scope);
}

function parsePaymentPlans(option?: CatalogueFeeOption | null): CataloguePaymentPlan[] {
  if (!option) return [];

  const rawPlans = option.plans_paiement_autorises_json;
  const parsed =
    typeof rawPlans === "string"
      ? (() => {
          try {
            return JSON.parse(rawPlans);
          } catch {
            return null;
          }
        })()
      : rawPlans;

  if (Array.isArray(parsed)) {
    const normalized = parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const plan = entry as Record<string, unknown>;
      const code = typeof plan.code === "string" ? plan.code.trim().toUpperCase() : "";
      const label = typeof plan.label === "string" ? plan.label.trim() : "";
      const nombreTranches = Number(plan.nombre_tranches ?? 0);
      const offsets = Array.isArray(plan.offsets_mois)
        ? plan.offsets_mois
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value >= 0)
        : [];
      if (!code || !label || !Number.isFinite(nombreTranches) || nombreTranches < 1) return [];
      if (offsets.length !== Math.trunc(nombreTranches)) return [];
      return [{
        code,
        label,
        nombre_tranches: Math.trunc(nombreTranches),
        offsets_mois: offsets,
      }];
    });
    if (normalized.length > 0) return normalized;
  }

  const fallbackCount = Math.max(1, Number(option.nombre_tranches ?? 1));
  return [{
    code:
      typeof option.plan_paiement_defaut_code === "string" && option.plan_paiement_defaut_code.trim()
        ? option.plan_paiement_defaut_code.trim().toUpperCase()
        : `${fallbackCount}X`,
    label: fallbackCount === 1 ? "Comptant" : `${fallbackCount} tranches`,
    nombre_tranches: fallbackCount,
    offsets_mois: Array.from({ length: fallbackCount }, (_, index) => index),
  }];
}

export default function InscriptionForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();

  const getInscriptionOptions = useInscriptionCreateStore(
    (state) => state.getInscriptionOptions,
  );
  const anneeScolaireId = useInscriptionCreateStore(
    (state) => state.anneeScolaireId,
  );
  const onCreateInscriptionFull = useInscriptionCreateStore(
    (state) => state.onCreateFull,
  );
  const setLoading = useInscriptionCreateStore((state) => state.setLoading);

  const classeOptions = useInscriptionCreateStore((state) => state.classeOptions);
  const transportLineOptions = useInscriptionCreateStore(
    (state) => state.transportLineOptions,
  );
  const transportStopOptions = useInscriptionCreateStore(
    (state) => state.transportStopOptions,
  );
  const cantineFormulaOptions = useInscriptionCreateStore(
    (state) => state.cantineFormulaOptions,
  );
  const catalogueFraisOptions = useInscriptionCreateStore(
    (state) => state.catalogueFraisOptions,
  );
  const remiseOptions = useInscriptionCreateStore((state) => state.remiseOptions);
  const parentTuteurOptions = useInscriptionCreateStore(
    (state) => state.parentTuteurOptions,
  );
  const scolariteInitialData = useInscriptionCreateStore(
    (state) => state.scolariteInitialData,
  );
  const [selectedNiveauId, setSelectedNiveauId] = useState<string | null>(null);
  const [selectedTransportActive, setSelectedTransportActive] = useState(false);
  const [selectedCantineActive, setSelectedCantineActive] = useState(false);
  const [selectedTransportLineId, setSelectedTransportLineId] = useState<string | null>(null);
  const [selectedInscriptionFeeId, setSelectedInscriptionFeeId] = useState<string | null>(null);
  const [selectedScolariteFeeId, setSelectedScolariteFeeId] = useState<string | null>(null);
  const [requiresPaymentDay, setRequiresPaymentDay] = useState(false);
  const [referentialCatalog, setReferentialCatalog] = useState<
    ReferentialCatalogItem[]
  >([]);

  useEffect(() => {
    if (etablissement_id) {
      void getInscriptionOptions(etablissement_id);
    }
  }, [etablissement_id, getInscriptionOptions]);

  useEffect(() => {
    const loadReferentials = async () => {
      const referencielService = new ReferencielService();
      const result = await referencielService.getCatalog();
      if (result?.status.success) {
        setReferentialCatalog((result.data as ReferentialCatalogItem[]) ?? []);
      }
    };

    void loadReferentials();
  }, []);

  const genreOptions = useMemo(
    () =>
      buildReferentialOptions(referentialCatalog, "PROFILE_GENRE", [
        "Homme",
        "Femme",
        "Autre",
      ]),
    [referentialCatalog],
  );

  const relationOptions = useMemo(
    () =>
      buildReferentialOptions(referentialCatalog, "SCOLARITE_RELATION", [
        "Pere",
        "Mere",
        "Tuteur",
        "Famille",
        "Autre",
      ]),
    [referentialCatalog],
  );

  const selectedTransportLine = useMemo(
    () =>
      transportLineOptions.find((option) => option.value === selectedTransportLineId) ??
      null,
    [selectedTransportLineId, transportLineOptions],
  );

  const selectedTransportZoneOptions = useMemo(
    () =>
      (selectedTransportLine?.zones ?? []).map((zone) => ({
        value: zone,
        label: zone,
      })),
    [selectedTransportLine],
  );

  const filteredTransportStopOptions = useMemo(() => {
    if (!selectedTransportLineId) return transportStopOptions;
    return transportStopOptions.filter(
      (option) => option.ligne_transport_id === selectedTransportLineId,
    );
  }, [selectedTransportLineId, transportStopOptions]);

  const eleveSchema = useMemo(
    () =>
      ProfilSchema.omit({
        id: true,
        created_at: true,
        updated_at: true,
        utilisateur_id: true,
        contact_urgence_json: true,
        photo_url: true,
      }).extend({
        contact_urgence_nom: z.string().optional().nullable(),
        contact_urgence_telephone: z.string().optional().nullable(),
        contact_urgence_relation: z.string().optional().nullable(),
      }),
    [],
  );

  const eleveFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(eleveSchema, {
        labelByField: {
          prenom: "Prenom",
          nom: "Nom",
          date_naissance: "Date de naissance",
          genre: "Genre",
          adresse: "Adresse",
          contact_urgence_nom: "Nom du contact d'urgence",
          contact_urgence_telephone: "Telephone d'urgence",
          contact_urgence_relation: "Lien avec l'eleve",
        },
        metaByField: {
          prenom: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Ex: Aina",
              description: "Prenom officiel de l'eleve.",
            },
          },
          nom: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Ex: Rakoto",
              description: "Nom de famille utilise pour les dossiers scolaires.",
            },
          },
          date_naissance: {
            dateMode: "date",
            fieldProps: {
              className: "md:col-span-1",
              description: "La date de naissance sera reprise dans la fiche eleve.",
            },
          },
          genre: {
            relation: {
              options: genreOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Selectionner",
            },
          },
          adresse: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder: "Adresse de residence de l'eleve",
              description: "Utile pour le suivi administratif et la communication.",
            },
          },
          contact_urgence_nom: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Ex: Oncle, grand-parent...",
              description: "Personne a joindre en cas d'urgence.",
            },
          },
          contact_urgence_telephone: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Telephone joignable rapidement",
              description: "Numero prioritaire si le parent principal est indisponible.",
            },
          },
          contact_urgence_relation: {
            relation: {
              options: relationOptions,
            },
            fieldProps: {
              className: "md:col-span-2",
              emptyLabel: "Selectionner",
            },
          },
        },
      }),
    [eleveSchema, genreOptions, relationOptions],
  );

  const scolariteSchema = useMemo(
    () =>
      z.object({
        code_eleve: z.string().optional().nullable(),
        classe_id: z.string().min(1, "Selectionnez une classe"),
        date_entree: z.coerce.date().nullable(),
        date_inscription: z.coerce.date(),
        statut_inscription: z.string().default("INSCRIT"),
      }),
    [],
  );

  const scolariteFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(scolariteSchema, {
        labelByField: {
          code_eleve: "Code eleve",
          classe_id: "Classe",
          date_entree: "Date d'entree",
          date_inscription: "Date d'inscription",
          statut_inscription: "Statut d'inscription",
        },
        metaByField: {
          code_eleve: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Code genere automatiquement",
              description: "Vous pouvez le conserver ou l'ajuster avant validation.",
            },
          },
          classe_id: {
            relation: { options: classeOptions },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir une classe",
              description: "La classe determine l'affectation scolaire initiale.",
            },
          },
          date_entree: {
            dateMode: "date",
            fieldProps: {
              className: "md:col-span-1",
            },
          },
          date_inscription: {
            dateMode: "date",
            fieldProps: {
              className: "md:col-span-1",
            },
          },
          statut_inscription: {
            relation: {
              options: [{ value: "INSCRIT", label: "Inscrit" }],
            },
            fieldProps: {
              className: "md:col-span-2",
              emptyLabel: "Selectionner",
              description: "La creation initiale ouvre directement un dossier inscrit.",
            },
          },
        },
      }),
    [classeOptions, scolariteSchema],
  );

  const tuteur1Schema = useMemo(
    () =>
      z
        .object({
          parent_tuteur_id: z.string().optional().nullable(),
          nom: z.string().optional().nullable(),
          prenom: z.string().optional().nullable(),
          telephone: z.string().optional().nullable(),
          email: z
            .string()
            .optional()
            .nullable()
            .refine((value) => !value || emailRegex.test(value), {
              message: "Format d'email incorrect.",
            }),
          adresse: z.string().optional().nullable(),
          relation: z.string().min(1, "Champ requis"),
          est_principal: z.boolean().default(true),
          autorise_recuperation: z.boolean().default(true),
        })
        .superRefine((data, ctx) => {
          if (normalizeOptionalString(data.parent_tuteur_id)) return;

          if (!normalizeOptionalString(data.nom)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["nom"],
              message: "Champ requis",
            });
          }

          if (!normalizeOptionalString(data.prenom)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["prenom"],
              message: "Champ requis",
            });
          }
        }),
    [],
  );

  const tuteur1Fields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(tuteur1Schema, {
        labelByField: {
          parent_tuteur_id: "Parent existant",
          nom: "Nom",
          prenom: "Prenom",
          telephone: "Telephone",
          email: "Email",
          adresse: "Adresse",
          relation: "Lien avec l'eleve",
          est_principal: "Tuteur principal",
          autorise_recuperation: "Autorise a recuperer l'eleve",
        },
        metaByField: {
          parent_tuteur_id: {
            relation: {
              options: [{ value: "", label: "Nouveau parent / tuteur" }, ...parentTuteurOptions],
            },
            fieldProps: {
              className: "md:col-span-2",
              emptyLabel: "Selectionner",
              description: "Selectionne un parent deja enregistre pour rattacher automatiquement la fratrie.",
            },
          },
          nom: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Nom du parent ou tuteur principal",
              description: "A remplir seulement si aucun parent existant n'est selectionne.",
            },
          },
          prenom: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Prenom du parent ou tuteur principal",
            },
          },
          telephone: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Numero prefere pour les appels",
            },
          },
          email: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "exemple@domaine.com",
            },
          },
          adresse: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder: "Adresse du parent ou tuteur principal",
            },
          },
          relation: {
            relation: {
              options: relationOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Selectionner",
            },
          },
          est_principal: {
            fieldProps: {
              className: "md:col-span-1",
              description: "Activez ce champ pour definir le contact principal du dossier.",
            },
          },
          autorise_recuperation: {
            fieldProps: {
              className: "md:col-span-2",
              description: "Autorise ce tuteur a recuperer l'eleve a la sortie.",
            },
          },
        },
      }),
    [parentTuteurOptions, relationOptions, tuteur1Schema],
  );

  const tuteur2Schema = useMemo(
    () =>
      z.object({
        parent_tuteur_id: z.string().optional().nullable(),
        nom: z.string().optional().nullable(),
        prenom: z.string().optional().nullable(),
        telephone: z.string().optional().nullable(),
        email: z
          .string()
          .optional()
          .nullable()
          .refine((value) => !value || emailRegex.test(value), {
            message: "Format d'email incorrect.",
          }),
        adresse: z.string().optional().nullable(),
        relation: z.string().optional().nullable(),
        est_principal: z.boolean().default(false),
        autorise_recuperation: z.boolean().default(true),
      }),
    [],
  );

  const tuteur2Fields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(tuteur2Schema, {
        labelByField: {
          parent_tuteur_id: "Parent existant",
          nom: "Nom",
          prenom: "Prenom",
          telephone: "Telephone",
          email: "Email",
          adresse: "Adresse",
          relation: "Lien avec l'eleve",
          est_principal: "Tuteur principal",
          autorise_recuperation: "Autorise a recuperer l'eleve",
        },
        metaByField: {
          parent_tuteur_id: {
            relation: {
              options: [{ value: "", label: "Aucun" }, ...parentTuteurOptions],
            },
            fieldProps: {
              className: "md:col-span-2",
              emptyLabel: "Selectionner",
              description: "Pratique pour retrouver la meme mere, le meme pere ou un tuteur deja connu.",
            },
          },
          nom: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Nom du second parent ou tuteur",
            },
          },
          prenom: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Prenom du second parent ou tuteur",
            },
          },
          telephone: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Numero secondaire",
            },
          },
          email: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "exemple@domaine.com",
            },
          },
          adresse: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder: "Adresse si differente du premier tuteur",
            },
          },
          relation: {
            relation: {
              options: relationOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Selectionner",
            },
          },
          est_principal: {
            fieldProps: {
              className: "md:col-span-1",
              description: `Actuellement: ${parseBooleanLabel(false)} par defaut.`,
            },
          },
          autorise_recuperation: {
            fieldProps: {
              className: "md:col-span-2",
            },
          },
        },
      }),
    [parentTuteurOptions, relationOptions, tuteur2Schema],
  );

  const servicesSchema = useMemo(
    () =>
      z
        .object({
          transport_active: z.boolean().default(false),
          transport_mode_facturation: z.literal("SERVICE_ONLY").default("SERVICE_ONLY"),
          ligne_transport_id: z.string().optional().nullable(),
          arret_transport_id: z.string().optional().nullable(),
          zone_transport: z.string().optional().nullable(),
          date_debut_service: z.coerce.date().optional().nullable(),
          date_fin_service: z.coerce.date().optional().nullable(),
          cantine_active: z.boolean().default(false),
          cantine_mode_facturation: z.literal("SERVICE_ONLY").default("SERVICE_ONLY"),
          formule_cantine_id: z.string().optional().nullable(),
        })
        .superRefine((data, ctx) => {
          if (data.transport_active && !data.ligne_transport_id) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["ligne_transport_id"],
              message: "Selectionnez une ligne de transport.",
            });
          }

          if (data.transport_active && !data.zone_transport) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["zone_transport"],
              message: "Selectionnez une zone de transport.",
            });
          }

          if (
            data.transport_active &&
            data.date_debut_service &&
            data.date_fin_service &&
            data.date_fin_service < data.date_debut_service
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["date_fin_service"],
              message:
                "La date de fin du service transport doit etre posterieure a la date de debut.",
            });
          }

          if (data.cantine_active && !data.formule_cantine_id) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["formule_cantine_id"],
              message: "Selectionnez une formule de cantine.",
            });
          }
        }),
    [],
  );

  const servicesFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(servicesSchema, {
        labelByField: {
          transport_active: "Activer le transport",
          transport_mode_facturation: "Activation transport",
          ligne_transport_id: "Ligne de transport",
          arret_transport_id: "Arret de transport",
          zone_transport: "Zone de transport",
          date_debut_service: "Debut du service transport",
          date_fin_service: "Fin du service transport",
          cantine_active: "Activer la cantine",
          cantine_mode_facturation: "Activation cantine",
          formule_cantine_id: "Formule de cantine",
        },
        metaByField: {
          transport_active: {
            fieldProps: {
              className: "md:col-span-2",
              description: "Creera un abonnement transport pour l'annee scolaire active.",
            },
          },
          ligne_transport_id: {
            relation: { options: transportLineOptions },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir une ligne",
              description: !selectedTransportActive
                ? "Active d'abord le transport pour rattacher une ligne."
                : selectedTransportLine && selectedTransportLine.inscriptions_ouvertes === false
                  ? "Cette ligne est actuellement fermee aux nouvelles demandes."
                  : "Choisissez la ligne a ouvrir dans le dossier eleve.",
            },
          },
          transport_mode_facturation: {
            relation: {
              options: [{ value: "SERVICE_ONLY", label: "Activer seulement" }],
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir",
              description:
                "L'inscription transport est creee sans encaissement local. La facturation sera reprise plus tard par Finance apres validation transport.",
            },
          },
          arret_transport_id: {
            relation: {
              options: filteredTransportStopOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir un arret",
              description:
                "Optionnel si seul l'abonnement a la ligne doit etre ouvert. Les arrets sont presentes avec leur ligne pour rester lisibles.",
            },
          },
          zone_transport: {
            relation: {
              options: selectedTransportZoneOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir une zone",
              description: selectedTransportLineId
                ? selectedTransportZoneOptions.length > 0
                  ? "La zone doit etre coherente avec la ligne choisie."
                  : "Aucune zone n'est encore parametree sur cette ligne."
                : "Choisissez d'abord une ligne pour afficher les zones disponibles.",
            },
          },
          date_debut_service: {
            dateMode: "date",
            fieldProps: {
              className: "md:col-span-1",
              description:
                "Date a partir de laquelle l'eleve commence effectivement a utiliser le transport.",
            },
          },
          date_fin_service: {
            dateMode: "date",
            fieldProps: {
              className: "md:col-span-1",
              description:
                "Optionnel. Renseignez-la si le service doit s'arreter avant la fin de l'annee.",
            },
          },
          cantine_active: {
            fieldProps: {
              className: "md:col-span-2",
              description: "Creera un abonnement cantine sur le dossier de l'eleve.",
            },
          },
          cantine_mode_facturation: {
            relation: {
              options: [{ value: "SERVICE_ONLY", label: "Activer seulement" }],
            },
            fieldProps: {
              className: "md:col-span-2",
              emptyLabel: "Choisir",
              description:
                "L'inscription cantine est creee sans encaissement local. La facturation sera reprise par Finance apres validation du service.",
            },
          },
          formule_cantine_id: {
            relation: {
              options: cantineFormulaOptions,
            },
            fieldProps: {
              className: "md:col-span-2",
              emptyLabel: "Choisir une formule",
              description:
                "La formule choisie sera rattachee a l'abonnement cantine si le service est active.",
            },
          },
        },
      }),
    [
      cantineFormulaOptions,
      filteredTransportStopOptions,
      servicesSchema,
      selectedTransportLine,
      selectedTransportLineId,
      selectedTransportZoneOptions,
      transportLineOptions,
    ],
  );

  const filteredCatalogueFraisOptions = useMemo(() => {
    if (!selectedNiveauId) {
      return catalogueFraisOptions;
    }
    return catalogueFraisOptions.filter(
      (option) =>
        option.niveau_scolaire_id === selectedNiveauId || !option.niveau_scolaire_id,
    );
  }, [catalogueFraisOptions, selectedNiveauId]);

  const inscriptionFeeOptions = useMemo(
    () => {
      return filteredCatalogueFraisOptions.filter((option) => {
        if (!matchesFeeScope(option as CatalogueFeeOption, ["GENERAL", "INSCRIPTION"])) {
          return false;
        }
        const feeOption = option as CatalogueFeeOption;
        const isInscriptionScope = (feeOption.usage_scope ?? "GENERAL").toUpperCase() === "INSCRIPTION";
        if (!isInscriptionScope) return true;
        return (feeOption.mode_facturation ?? "").toUpperCase() === "PONCTUEL" || !feeOption.est_recurrent;
      });
    },
    [filteredCatalogueFraisOptions],
  );

  const selectedInscriptionFee = useMemo(
    () =>
      inscriptionFeeOptions.find((option) => option.value === selectedInscriptionFeeId) ?? null,
    [inscriptionFeeOptions, selectedInscriptionFeeId],
  );

  const selectedInscriptionPaymentPlans = useMemo(
    () => parsePaymentPlans(selectedInscriptionFee as CatalogueFeeOption | null),
    [selectedInscriptionFee],
  );

  const inscriptionPlanOptions = useMemo(
    () =>
      selectedInscriptionPaymentPlans.map((plan) => ({
        value: plan.code,
        label: `${plan.label} - ${plan.nombre_tranches} tranche${plan.nombre_tranches > 1 ? "s" : ""}`,
      })),
    [selectedInscriptionPaymentPlans],
  );

  const scolariteFeeOptions = useMemo(
    () =>
      filteredCatalogueFraisOptions.filter((option) => {
        if (!matchesFeeScope(option as CatalogueFeeOption, ["GENERAL", "SCOLARITE"])) {
          return false;
        }
        const feeOption = option as CatalogueFeeOption;
        const isScolariteScope = (feeOption.usage_scope ?? "GENERAL").toUpperCase() === "SCOLARITE";
        if (!isScolariteScope) return true;
        return (feeOption.mode_facturation ?? "").toUpperCase() === "ANNUEL" || !feeOption.est_recurrent;
      }),
    [filteredCatalogueFraisOptions],
  );

  const selectedScolariteFee = useMemo(
    () =>
      scolariteFeeOptions.find((option) => option.value === selectedScolariteFeeId) ?? null,
    [scolariteFeeOptions, selectedScolariteFeeId],
  );

  const selectedScolaritePaymentPlans = useMemo(
    () => parsePaymentPlans(selectedScolariteFee as CatalogueFeeOption | null),
    [selectedScolariteFee],
  );

  const scolaritePlanOptions = useMemo(
    () =>
      selectedScolaritePaymentPlans.map((plan) => ({
        value: plan.code,
        label: `${plan.label} - ${plan.nombre_tranches} tranche${plan.nombre_tranches > 1 ? "s" : ""}`,
      })),
    [selectedScolaritePaymentPlans],
  );

  const financeSchema = useMemo(
    () =>
      z
        .object({
          catalogue_frais_inscription_id: z.string().optional().nullable(),
          catalogue_frais_inscription_plan_code: z.string().optional().nullable(),
          catalogue_frais_scolarite_id: z.string().optional().nullable(),
          catalogue_frais_scolarite_plan_code: z.string().optional().nullable(),
          remise_id: z.string().optional().nullable(),
          remise_type: z.string().default("AUCUNE"),
          remise_valeur: z.coerce.number().min(0).default(0),
        })
        .superRefine((data, ctx) => {
          if (data.catalogue_frais_inscription_id && selectedInscriptionPaymentPlans.length > 0) {
            const selectedCode = normalizeOptionalString(data.catalogue_frais_inscription_plan_code);
            if (!selectedCode) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["catalogue_frais_inscription_plan_code"],
                message: "Choisis le plan autorise pour le droit d'inscription.",
              });
              return;
            }
            const exists = selectedInscriptionPaymentPlans.some(
              (plan) => plan.code.toUpperCase() === selectedCode.toUpperCase(),
            );
            if (!exists) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["catalogue_frais_inscription_plan_code"],
                message: "Le plan choisi n'est pas autorise pour ce droit d'inscription.",
              });
            }
          }
          if (data.catalogue_frais_scolarite_id && selectedScolaritePaymentPlans.length > 0) {
            const selectedCode = normalizeOptionalString(data.catalogue_frais_scolarite_plan_code);
            if (!selectedCode) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["catalogue_frais_scolarite_plan_code"],
                message: "Choisis le plan annuel de scolarite a appliquer.",
              });
              return;
            }
            const exists = selectedScolaritePaymentPlans.some(
              (plan) => plan.code.toUpperCase() === selectedCode.toUpperCase(),
            );
            if (!exists) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["catalogue_frais_scolarite_plan_code"],
                message: "Le plan choisi n'est pas autorise pour ce frais de scolarite.",
              });
            }
          }
        }),
    [selectedInscriptionPaymentPlans, selectedScolaritePaymentPlans],
  );

  const financeFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(financeSchema, {
        labelByField: {
          catalogue_frais_inscription_id: "Frais d'inscription",
          catalogue_frais_inscription_plan_code: "Plan de paiement inscription",
          catalogue_frais_scolarite_id: "Frais de scolarite",
          catalogue_frais_scolarite_plan_code: "Plan de paiement scolarite",
          remise_id: "Remise preconfiguree",
          remise_type: "Type de remise",
          remise_valeur: "Valeur de la remise",
        },
        metaByField: {
          catalogue_frais_inscription_id: {
            relation: {
              options: inscriptionFeeOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Selectionner un frais",
              description: selectedNiveauId
                ? "Tarif du niveau selectionne ou frais global applicable a toutes les classes. Seuls les frais approuves apparaissent ici."
                : "Sans classe selectionnee, tous les frais approuves restent visibles. Choisissez une classe pour prioriser automatiquement ceux du niveau.",
            },
          },
          catalogue_frais_inscription_plan_code: {
            relation: {
              options: inscriptionPlanOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: selectedInscriptionFee
                ? "Choisir un plan autorise"
                : "Selectionner d'abord un frais",
              description: selectedInscriptionFee
                ? "Le droit d'inscription reste ponctuel, avec seulement quelques plans courts autorises."
                : "Choisissez d'abord un frais d'inscription pour afficher ses plans autorises.",
            },
          },
          catalogue_frais_scolarite_id: {
            relation: {
              options: scolariteFeeOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Selectionner un frais",
              description: selectedNiveauId
                ? "Tarif standard du niveau selectionne ou frais global. Seuls les frais approuves apparaissent ici."
                : "Sans classe selectionnee, tous les frais approuves restent visibles. Choisissez une classe pour prioriser automatiquement ceux du niveau.",
            },
          },
          catalogue_frais_scolarite_plan_code: {
            relation: {
              options: scolaritePlanOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: selectedScolariteFee
                ? "Choisir un plan annuel"
                : "Selectionner d'abord un frais",
              description: selectedScolariteFee
                ? "Le plan annuel fixe le nombre de tranches autorisees pour la scolarite."
                : "Choisissez d'abord un frais de scolarite pour afficher ses plans autorises.",
            },
          },
          remise_id: {
            relation: {
              options: [{ value: "", label: "Aucune remise" }, ...remiseOptions],
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir",
              description: "Si une remise finance existe deja, elle prime sur la saisie manuelle.",
            },
          },
          remise_type: {
            relation: {
              options: [
                { value: "AUCUNE", label: "Aucune" },
                { value: "PERCENT", label: "Pourcentage" },
                { value: "FIXED", label: "Montant fixe" },
              ],
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir",
            },
          },
          remise_valeur: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "0",
              description: "Utilise seulement si aucune remise preconfiguree n'est selectionnee.",
            },
          },
        },
      }),
    [
      financeSchema,
      inscriptionPlanOptions,
      inscriptionFeeOptions,
      remiseOptions,
      scolaritePlanOptions,
      selectedInscriptionFee,
      scolariteFeeOptions,
      selectedScolariteFee,
      selectedNiveauId,
    ],
  );

  const echeancierSchema = useMemo(
    () =>
      z
        .object({
          jour_paiement_mensuel: z.coerce.number().int().min(1).max(28).optional().nullable(),
          notes: z.string().optional().nullable(),
        })
        .superRefine((data, ctx) => {
          if (
            requiresPaymentDay &&
            (data.jour_paiement_mensuel == null || Number.isNaN(Number(data.jour_paiement_mensuel)))
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["jour_paiement_mensuel"],
              message: "Renseigne le jour du mois pour les plans en plusieurs tranches.",
            });
          }
        }),
    [requiresPaymentDay],
  );

  const echeancierFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(echeancierSchema, {
        labelByField: {
          jour_paiement_mensuel: "Jour de paiement du mois",
          notes: "Notes administratives",
        },
        metaByField: {
          jour_paiement_mensuel: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Ex: 5",
              description: requiresPaymentDay
                ? "Jour fixe du mois applique a la scolarite et aux autres tranches echelonnables."
                : "Optionnel si tous les frais sont en reglement unique.",
            },
          },
          notes: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Consignes, engagements, informations utiles...",
              description: "Le mode de paiement sera deduit automatiquement du plan genere.",
            },
          },
        },
      }),
    [echeancierSchema],
  );

  const handleFinanceValuesChange = (data: Record<string, any>) => {
    const selectedInscriptionFeeValue = normalizeOptionalString(data?.catalogue_frais_inscription_id);
    const selectedInscription = inscriptionFeeOptions.find(
      (item) => item.value === selectedInscriptionFeeValue,
    ) ?? null;
    const selectedInscriptionPlanCode = normalizeOptionalString(
      data?.catalogue_frais_inscription_plan_code,
    );
    const inscriptionPlans = parsePaymentPlans(selectedInscription as CatalogueFeeOption | null);
    const selectedInscriptionPlan =
      inscriptionPlans.find((plan) => plan.code === (selectedInscriptionPlanCode ?? "").toUpperCase()) ?? null;

    const selectedScolariteFeeValue = normalizeOptionalString(data?.catalogue_frais_scolarite_id);
    const selectedScolarite = scolariteFeeOptions.find(
      (item) => item.value === selectedScolariteFeeValue,
    ) ?? null;
    const selectedScolaritePlanCode = normalizeOptionalString(data?.catalogue_frais_scolarite_plan_code);
    const scolaritePlans = parsePaymentPlans(selectedScolarite as CatalogueFeeOption | null);
    const selectedScolaritePlan =
      scolaritePlans.find((plan) => plan.code === (selectedScolaritePlanCode ?? "").toUpperCase()) ?? null;

    setSelectedInscriptionFeeId(selectedInscriptionFeeValue);
    setSelectedScolariteFeeId(selectedScolariteFeeValue);
    setRequiresPaymentDay(
      (selectedInscriptionPlan?.nombre_tranches ?? 1) > 1 ||
      (selectedScolaritePlan?.nombre_tranches ?? 1) > 1,
    );
  };

  const steps: WizardStep[] = useMemo(
    () => [
      {
        key: "eleve",
        title: "Fiche eleve",
        desc: "Identite, adresse et contact d'urgence du dossier.",
        schema: eleveSchema,
        fields: eleveFields,
        labelMessage: "Eleve",
        icon: <FiUser />,
      },
      {
        key: "scolarite",
        title: "Affectation scolaire",
        desc: "Classe, code eleve et dates de reference de l'inscription.",
        schema: scolariteSchema,
        fields: scolariteFields,
        initialValues: scolariteInitialData ?? undefined,
        labelMessage: "Scolarite",
        icon: <FiBookOpen />,
      },
      {
        key: "tuteur1",
        title: "Parent ou tuteur principal",
        desc: "Responsable legal principal a rattacher immediatement.",
        schema: tuteur1Schema,
        fields: tuteur1Fields,
        initialValues: {
          est_principal: true,
          autorise_recuperation: true,
        },
        labelMessage: "Tuteur principal",
        icon: <FiShield />,
      },
      {
        key: "tuteur2",
        title: "Second parent ou tuteur",
        desc: "Contact secondaire optionnel pour le suivi familial.",
        schema: tuteur2Schema,
        fields: tuteur2Fields,
        initialValues: {
          est_principal: false,
          autorise_recuperation: true,
        },
        labelMessage: "Tuteur secondaire",
        icon: <FiUsers />,
      },
      {
        key: "services",
        title: "Services annexes",
        desc: "Transport et cantine a ouvrir des l'inscription si besoin.",
        schema: servicesSchema,
        fields: servicesFields,
        initialValues: {
          transport_active: false,
          transport_mode_facturation: "SERVICE_ONLY",
          cantine_active: false,
          cantine_mode_facturation: "SERVICE_ONLY",
        },
        labelMessage: "Services",
        icon: <FiTruck />,
      },
      {
        key: "finance",
        title: "Montants et remise",
        desc: "Selection des frais catalogue, avec un plan annuel autorise pour la scolarite et des tranches libres uniquement pour l'inscription.",
        schema: financeSchema,
        fields: financeFields,
        onValuesChange: handleFinanceValuesChange,
        initialValues: {
          catalogue_frais_inscription_id: "",
          catalogue_frais_inscription_plan_code: "",
          catalogue_frais_scolarite_id: "",
          catalogue_frais_scolarite_plan_code: "",
          remise_id: "",
          remise_type: "AUCUNE",
          remise_valeur: 0,
        },
        labelMessage: "Finance",
        icon: <FiCreditCard />,
      },
      {
        key: "echeancier",
        title: "Plan de paiement",
        desc: "Jour de paiement du mois et generation automatique des echeances a partir du plan annuel choisi.",
        schema: echeancierSchema,
        fields: echeancierFields,
        initialValues: {
          jour_paiement_mensuel: 5,
          notes: "",
        },
        labelMessage: "Echeancier",
        icon: <FiMapPin />,
      },
    ],
    [
      echeancierFields,
      echeancierSchema,
      eleveFields,
      eleveSchema,
      financeFields,
      financeSchema,
      scolariteFields,
      scolariteInitialData,
      scolariteSchema,
      servicesFields,
      servicesSchema,
      tuteur1Fields,
      tuteur1Schema,
      tuteur2Fields,
      tuteur2Schema,
      handleFinanceValuesChange,
    ],
  );

  const financeStepIndex = useMemo(
    () => steps.findIndex((item) => item.key === "finance"),
    [steps],
  );

  const handleFinish = async (finalData: WizardData) => {
    try {
      setLoading(true);

      if (!etablissement_id) {
        info("Etablissement introuvable, veuillez vous reconnecter.", "error");
        return;
      }

      if (!anneeScolaireId) {
        info("Annee scolaire non chargee. Rechargez la page.", "error");
        return;
      }

      const scolarite = finalData.scolarite ?? {};
      if (!scolarite.classe_id) {
        info("Merci de selectionner une classe.", "warning");
        return;
      }

      const eleve = finalData.eleve ?? {};
      const contactUrgenceNom = normalizeOptionalString(eleve.contact_urgence_nom);
      const contactUrgenceTelephone = normalizeOptionalString(
        eleve.contact_urgence_telephone,
      );
      const contactUrgenceRelation = normalizeOptionalString(
        eleve.contact_urgence_relation,
      );

      const contactUrgence =
        contactUrgenceNom || contactUrgenceTelephone || contactUrgenceRelation
          ? {
              nom: contactUrgenceNom,
              telephone: contactUrgenceTelephone,
              relation: contactUrgenceRelation,
            }
          : null;

      const normalizedServices = {
        transport_active: Boolean(finalData.services?.transport_active),
        transport_mode_facturation: "SERVICE_ONLY" as const,
        ligne_transport_id: normalizeOptionalString(
          finalData.services?.ligne_transport_id,
        ),
        arret_transport_id: normalizeOptionalString(
          finalData.services?.arret_transport_id,
        ),
        zone_transport: normalizeOptionalString(finalData.services?.zone_transport),
        date_debut_service:
          finalData.services?.date_debut_service instanceof Date
            ? finalData.services.date_debut_service.toISOString().slice(0, 10)
            : normalizeOptionalString(finalData.services?.date_debut_service),
        date_fin_service:
          finalData.services?.date_fin_service instanceof Date
            ? finalData.services.date_fin_service.toISOString().slice(0, 10)
            : normalizeOptionalString(finalData.services?.date_fin_service),
        cantine_active: Boolean(finalData.services?.cantine_active),
        cantine_mode_facturation: "SERVICE_ONLY",
        formule_cantine_id: normalizeOptionalString(
          finalData.services?.formule_cantine_id,
        ),
      };

      if (!normalizedServices.transport_active) {
        normalizedServices.ligne_transport_id = null;
        normalizedServices.arret_transport_id = null;
        normalizedServices.zone_transport = null;
        normalizedServices.date_debut_service = null;
        normalizedServices.date_fin_service = null;
      }

      if (!normalizedServices.ligne_transport_id) {
        normalizedServices.arret_transport_id = null;
        normalizedServices.zone_transport = null;
      }

      if (!normalizedServices.cantine_active) {
        normalizedServices.formule_cantine_id = null;
      }

      const normalizedFinance = {
        catalogue_frais_inscription_id: normalizeOptionalString(
          finalData.finance?.catalogue_frais_inscription_id,
        ),
        catalogue_frais_inscription_plan_code: normalizeOptionalString(
          finalData.finance?.catalogue_frais_inscription_plan_code,
        ),
        catalogue_frais_scolarite_id: normalizeOptionalString(
          finalData.finance?.catalogue_frais_scolarite_id,
        ),
        catalogue_frais_scolarite_plan_code: normalizeOptionalString(
          finalData.finance?.catalogue_frais_scolarite_plan_code,
        ),
        remise_id: normalizeOptionalString(finalData.finance?.remise_id),
        remise_type: finalData.finance?.remise_type ?? "AUCUNE",
        remise_valeur: Number(finalData.finance?.remise_valeur ?? 0),
      };

      const payload = {
        etablissement_id,
        annee_scolaire_id: anneeScolaireId,
        eleve: {
          prenom: eleve.prenom,
          nom: eleve.nom,
          date_naissance: eleve.date_naissance ?? null,
          genre: normalizeOptionalString(eleve.genre),
          adresse: normalizeOptionalString(eleve.adresse),
          contact_urgence_json: contactUrgence,
        },
        scolarite: {
          ...scolarite,
          statut_inscription: (scolarite.statut_inscription ??
            "INSCRIT") as StatutInscription,
        },
        tuteurs: [finalData.tuteur1, finalData.tuteur2]
          .filter(Boolean)
          .filter(
            (t: any) =>
              t &&
              (normalizeOptionalString(t.parent_tuteur_id) ||
                normalizeOptionalString(t.nom) ||
                normalizeOptionalString(t.prenom) ||
                normalizeOptionalString(t.telephone) ||
                normalizeOptionalString(t.email)),
          )
          .map((t: any) => ({
            parent_tuteur_id: normalizeOptionalString(t.parent_tuteur_id),
            nom: normalizeOptionalString(t.nom),
            prenom: normalizeOptionalString(t.prenom),
            telephone: normalizeOptionalString(t.telephone),
            email: normalizeOptionalString(t.email),
            adresse: normalizeOptionalString(t.adresse),
            relation: normalizeOptionalString(t.relation),
            est_principal: Boolean(t.est_principal),
            autorise_recuperation: Boolean(t.autorise_recuperation),
          })),
        services: normalizedServices,
        finance: normalizedFinance,
        echeancier: {
          jour_paiement_mensuel:
            finalData.echeancier?.jour_paiement_mensuel == null
              ? null
              : Math.max(
                  1,
                  Math.min(28, Number(finalData.echeancier?.jour_paiement_mensuel ?? 5)),
                ),
          notes: normalizeOptionalString(finalData.echeancier?.notes),
        },
      };

      const result = await onCreateInscriptionFull(payload);
      if (!result?.status?.success) {
        throw new Error("Creation de l'inscription impossible");
      }

      info("Eleve inscrit avec succes.", "success");
    } catch (error) {
      console.error("Erreur finalisation inscription :", error);
      info("Impossible de finaliser l'inscription.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MultiStepFormWizard
      title="Inscrire un eleve"
      subtitle="Construisez un dossier complet et propre, depuis la fiche eleve jusqu'aux services et au plan financier."
      steps={steps}
      onFinish={handleFinish}
      onStepChange={(stepIndex, allData) => {
        if (etablissement_id && stepIndex === financeStepIndex) {
          void getInscriptionOptions(etablissement_id);
        }

        const selectedClasseId = allData?.scolarite?.classe_id;
        const selectedClasse = classeOptions.find((item) => item.value === selectedClasseId);
        const selectedInscriptionFeeValue = normalizeOptionalString(allData?.finance?.catalogue_frais_inscription_id);
        const selectedInscription = inscriptionFeeOptions.find((item) => item.value === selectedInscriptionFeeValue) ?? null;
        const selectedInscriptionPlanCode = normalizeOptionalString(allData?.finance?.catalogue_frais_inscription_plan_code);
        const inscriptionPlans = parsePaymentPlans(selectedInscription as CatalogueFeeOption | null);
        const selectedInscriptionPlan =
          inscriptionPlans.find((plan) => plan.code === (selectedInscriptionPlanCode ?? "").toUpperCase()) ?? null;
        const selectedScolariteFeeValue = normalizeOptionalString(allData?.finance?.catalogue_frais_scolarite_id);
        const selectedScolarite = scolariteFeeOptions.find((item) => item.value === selectedScolariteFeeValue) ?? null;
        const selectedScolaritePlanCode = normalizeOptionalString(allData?.finance?.catalogue_frais_scolarite_plan_code);
        const scolaritePlans = parsePaymentPlans(selectedScolarite as CatalogueFeeOption | null);
        const selectedScolaritePlan =
          scolaritePlans.find((plan) => plan.code === (selectedScolaritePlanCode ?? "").toUpperCase()) ?? null;
        setSelectedNiveauId(selectedClasse?.niveau_scolaire_id ?? null);
        setSelectedTransportActive(Boolean(allData?.services?.transport_active));
        setSelectedCantineActive(Boolean(allData?.services?.cantine_active));
        setSelectedTransportLineId(
          normalizeOptionalString(allData?.services?.ligne_transport_id),
        );
        setSelectedInscriptionFeeId(selectedInscriptionFeeValue);
        setSelectedScolariteFeeId(selectedScolariteFeeValue);
        setRequiresPaymentDay(
          (selectedInscriptionPlan?.nombre_tranches ?? 1) > 1 ||
          (selectedScolaritePlan?.nombre_tranches ?? 1) > 1,
        );
      }}
      submitHint="Chaque etape enregistre des informations utiles au dossier eleve. La derniere validation cree l'inscription, les rattachements et la base du suivi financier."
    />
  );
}
