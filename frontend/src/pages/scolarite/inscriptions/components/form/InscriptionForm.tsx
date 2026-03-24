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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseBooleanLabel(value?: boolean) {
  return value ? "Oui" : "Non";
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
  const scolariteInitialData = useInscriptionCreateStore(
    (state) => state.scolariteInitialData,
  );
  const [selectedNiveauId, setSelectedNiveauId] = useState<string | null>(null);
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
      z.object({
        nom: z.string().min(1, "Champ requis"),
        prenom: z.string().min(1, "Champ requis"),
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
      }),
    [],
  );

  const tuteur1Fields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(tuteur1Schema, {
        labelByField: {
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
          nom: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Nom du parent ou tuteur principal",
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
    [relationOptions, tuteur1Schema],
  );

  const tuteur2Schema = useMemo(
    () =>
      z.object({
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
    [relationOptions, tuteur2Schema],
  );

  const servicesSchema = useMemo(
    () =>
      z
        .object({
          transport_active: z.boolean().default(false),
          ligne_transport_id: z.string().optional().nullable(),
          arret_transport_id: z.string().optional().nullable(),
          cantine_active: z.boolean().default(false),
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
          ligne_transport_id: "Ligne de transport",
          arret_transport_id: "Arret de transport",
          cantine_active: "Activer la cantine",
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
            },
          },
          arret_transport_id: {
            relation: { options: transportStopOptions },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir un arret",
              description: "Optionnel si seul l'abonnement a la ligne doit etre ouvert.",
            },
          },
          cantine_active: {
            fieldProps: {
              className: "md:col-span-2",
              description: "Creera un abonnement cantine sur le dossier de l'eleve.",
            },
          },
          formule_cantine_id: {
            relation: { options: cantineFormulaOptions },
            fieldProps: {
              className: "md:col-span-2",
              emptyLabel: "Choisir une formule",
            },
          },
        },
      }),
    [
      cantineFormulaOptions,
      servicesSchema,
      transportLineOptions,
      transportStopOptions,
    ],
  );

  const financeSchema = useMemo(
    () =>
      z.object({
        catalogue_frais_inscription_id: z.string().optional().nullable(),
        catalogue_frais_scolarite_id: z.string().optional().nullable(),
        catalogue_frais_transport_id: z.string().optional().nullable(),
        catalogue_frais_cantine_id: z.string().optional().nullable(),
        remise_id: z.string().optional().nullable(),
        remise_type: z.string().default("AUCUNE"),
        remise_valeur: z.coerce.number().min(0).default(0),
      }),
    [],
  );

  const filteredCatalogueFraisOptions = useMemo(() => {
    if (!selectedNiveauId) return [];
    return catalogueFraisOptions.filter(
      (option) => option.niveau_scolaire_id === selectedNiveauId,
    );
  }, [catalogueFraisOptions, selectedNiveauId]);

  const financeFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(financeSchema, {
        labelByField: {
          catalogue_frais_inscription_id: "Frais d'inscription",
          catalogue_frais_scolarite_id: "Frais de scolarite",
          catalogue_frais_transport_id: "Frais de transport",
          catalogue_frais_cantine_id: "Frais de cantine",
          remise_id: "Remise preconfiguree",
          remise_type: "Type de remise",
          remise_valeur: "Valeur de la remise",
        },
        metaByField: {
          catalogue_frais_inscription_id: {
            relation: {
              options: filteredCatalogueFraisOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Selectionner un frais",
              description: selectedNiveauId
                ? "Tarif catalogue du niveau selectionne applique a l'ouverture du dossier."
                : "Choisissez d'abord la classe pour charger les frais du bon niveau.",
            },
          },
          catalogue_frais_scolarite_id: {
            relation: {
              options: filteredCatalogueFraisOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Selectionner un frais",
              description: selectedNiveauId
                ? "Tarif standard de scolarite du niveau selectionne."
                : "Choisissez d'abord la classe pour charger les frais du bon niveau.",
            },
          },
          catalogue_frais_transport_id: {
            relation: {
              options: filteredCatalogueFraisOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Selectionner un frais",
              description: selectedNiveauId
                ? "Frais de transport du niveau selectionne, si le service doit etre facture."
                : "Choisissez d'abord la classe pour charger les frais du bon niveau.",
            },
          },
          catalogue_frais_cantine_id: {
            relation: {
              options: filteredCatalogueFraisOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Selectionner un frais",
              description: selectedNiveauId
                ? "Frais de cantine du niveau selectionne, si la cantine est facturee."
                : "Choisissez d'abord la classe pour charger les frais du bon niveau.",
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
    [filteredCatalogueFraisOptions, financeSchema, remiseOptions, selectedNiveauId],
  );

  const echeancierSchema = useMemo(
    () =>
      z
        .object({
          mode_paiement: z.string().min(1, "Champ requis"),
          nombre_tranches: z.coerce.number().min(1).default(1),
          premiere_echeance: z.coerce.date(),
          notes: z.string().optional().nullable(),
        })
        .superRefine((data, ctx) => {
          const mode = (data.mode_paiement ?? "").toUpperCase();
          if (mode === "COMPTANT" && Number(data.nombre_tranches ?? 1) !== 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["nombre_tranches"],
              message: "Le mode comptant utilise une seule tranche.",
            });
          }
        }),
    [],
  );

  const echeancierFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(echeancierSchema, {
        labelByField: {
          mode_paiement: "Mode de paiement",
          nombre_tranches: "Nombre de tranches",
          premiere_echeance: "Premiere echeance",
          notes: "Notes administratives",
        },
        metaByField: {
          mode_paiement: {
            relation: {
              options: [
                { value: "COMPTANT", label: "Comptant" },
                { value: "ECHELONNE", label: "Echelonne" },
              ],
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir un mode",
              description: "Comptant = reglement immediat. Echelonne = creation de plusieurs echeances.",
            },
          },
          nombre_tranches: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "1",
              description: "Utilise pour construire les echeances reelles du dossier financier.",
            },
          },
          premiere_echeance: {
            dateMode: "date",
            fieldProps: {
              className: "md:col-span-1",
              description: "Sera reprise comme premiere echeance du plan financier.",
            },
          },
          notes: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Consignes, engagements, informations utiles...",
            },
          },
        },
      }),
    [echeancierSchema],
  );

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
          cantine_active: false,
        },
        labelMessage: "Services",
        icon: <FiTruck />,
      },
      {
        key: "finance",
        title: "Montants et remise",
        desc: "Selection des frais catalogue et de la remise a appliquer au dossier.",
        schema: financeSchema,
        fields: financeFields,
        initialValues: {
          catalogue_frais_inscription_id: "",
          catalogue_frais_scolarite_id: "",
          catalogue_frais_transport_id: "",
          catalogue_frais_cantine_id: "",
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
        desc: "Mode de reglement, premiere echeance et notes de suivi.",
        schema: echeancierSchema,
        fields: echeancierFields,
        initialValues: {
          mode_paiement: "COMPTANT",
          nombre_tranches: 1,
          premiere_echeance: new Date().toISOString().slice(0, 10),
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
    ],
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
              (normalizeOptionalString(t.nom) ||
                normalizeOptionalString(t.prenom) ||
                normalizeOptionalString(t.telephone) ||
                normalizeOptionalString(t.email)),
          )
          .map((t: any) => ({
            nom: normalizeOptionalString(t.nom),
            prenom: normalizeOptionalString(t.prenom),
            telephone: normalizeOptionalString(t.telephone),
            email: normalizeOptionalString(t.email),
            adresse: normalizeOptionalString(t.adresse),
            relation: normalizeOptionalString(t.relation),
            est_principal: Boolean(t.est_principal),
            autorise_recuperation: Boolean(t.autorise_recuperation),
          })),
        services: {
          transport_active: Boolean(finalData.services?.transport_active),
          ligne_transport_id: normalizeOptionalString(
            finalData.services?.ligne_transport_id,
          ),
          arret_transport_id: normalizeOptionalString(
            finalData.services?.arret_transport_id,
          ),
          cantine_active: Boolean(finalData.services?.cantine_active),
          formule_cantine_id: normalizeOptionalString(
            finalData.services?.formule_cantine_id,
          ),
        },
        finance: {
          catalogue_frais_inscription_id: normalizeOptionalString(
            finalData.finance?.catalogue_frais_inscription_id,
          ),
          catalogue_frais_scolarite_id: normalizeOptionalString(
            finalData.finance?.catalogue_frais_scolarite_id,
          ),
          catalogue_frais_transport_id: normalizeOptionalString(
            finalData.finance?.catalogue_frais_transport_id,
          ),
          catalogue_frais_cantine_id: normalizeOptionalString(
            finalData.finance?.catalogue_frais_cantine_id,
          ),
          remise_id: normalizeOptionalString(finalData.finance?.remise_id),
          remise_type: finalData.finance?.remise_type ?? "AUCUNE",
          remise_valeur: Number(finalData.finance?.remise_valeur ?? 0),
        },
        echeancier: {
          mode_paiement: finalData.echeancier?.mode_paiement ?? "COMPTANT",
          nombre_tranches:
            (finalData.echeancier?.mode_paiement ?? "COMPTANT") === "COMPTANT"
              ? 1
              : Math.max(1, Number(finalData.echeancier?.nombre_tranches ?? 1)),
          premiere_echeance: finalData.echeancier?.premiere_echeance,
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
      onStepChange={(_, allData) => {
        const selectedClasseId = allData?.scolarite?.classe_id;
        const selectedClasse = classeOptions.find((item) => item.value === selectedClasseId);
        setSelectedNiveauId(selectedClasse?.niveau_scolaire_id ?? null);
      }}
      submitHint="Chaque etape enregistre des informations utiles au dossier eleve. La derniere validation cree l'inscription, les rattachements et la base du suivi financier."
    />
  );
}
