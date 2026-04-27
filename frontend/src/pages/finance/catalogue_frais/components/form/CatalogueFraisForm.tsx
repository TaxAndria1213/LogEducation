import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import CatalogueFraisService from "../../../../../services/catalogueFrais.service";
import { useAuth } from "../../../../../auth/AuthContext";
import ReferencielService, { buildReferentialOptions, type ReferentialCatalogItem } from "../../../../../services/referenciel.service";
import NiveauScolaireService from "../../../../../services/niveau.service";

const periodiciteOptions = [
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "monthly", label: "Mensuel" },
  { value: "term", label: "Par trimestre" },
  { value: "semester", label: "Semestriel" },
  { value: "year", label: "Annuel" },
];

const modeFacturationOptions = [
  { value: "PONCTUEL", label: "Ponctuel" },
  { value: "ANNUEL", label: "Annuel" },
  { value: "RECURRENT", label: "Recurrent" },
];

const usageScopeOptions = [
  { value: "GENERAL", label: "General" },
  { value: "INSCRIPTION", label: "Inscription" },
  { value: "SCOLARITE", label: "Scolarite" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "CANTINE", label: "Cantine" },
  { value: "OPTION_PEDAGOGIQUE", label: "Option pedagogique" },
  { value: "ACTIVITE_EXTRASCOLAIRE", label: "Activite extrascolaire" },
  { value: "FOURNITURE", label: "Fourniture" },
  { value: "UNIFORME", label: "Uniforme" },
  { value: "BADGE", label: "Badge" },
  { value: "EXAMEN", label: "Examen" },
  { value: "RATTRAPAGE", label: "Rattrapage" },
  { value: "COMPLEMENTAIRE", label: "Complementaire" },
];

const defaultScolaritePlans = JSON.stringify(
  [
    { code: "1X", label: "Comptant", nombre_tranches: 1, offsets_mois: [0] },
    { code: "3X", label: "3 tranches", nombre_tranches: 3, offsets_mois: [0, 4, 8] },
    {
      code: "10X",
      label: "10 tranches",
      nombre_tranches: 10,
      offsets_mois: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
  ],
  null,
  2,
);

const defaultInscriptionPlans = JSON.stringify(
  [
    { code: "1X", label: "Comptant", nombre_tranches: 1, offsets_mois: [0] },
    { code: "2X", label: "2 tranches", nombre_tranches: 2, offsets_mois: [0, 1] },
    { code: "3X", label: "3 tranches", nombre_tranches: 3, offsets_mois: [0, 1, 2] },
  ],
  null,
  2,
);

function CatalogueFraisForm() {
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new CatalogueFraisService(), []);
  const [referentialCatalog, setReferentialCatalog] = useState<ReferentialCatalogItem[]>([]);
  const [niveauOptions, setNiveauOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [selectedUsageScope, setSelectedUsageScope] = useState("GENERAL");

  useEffect(() => {
    const loadReferentials = async () => {
      const referencielService = new ReferencielService();
      const niveauService = new NiveauScolaireService();
      const [catalogResult, niveauResult] = await Promise.all([
        referencielService.getCatalog(),
        etablissement_id
          ? niveauService.getAll({
            take: 1000,
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
          })
          : Promise.resolve(null),
      ]);
      if (catalogResult?.status.success) {
        setReferentialCatalog((catalogResult.data as ReferentialCatalogItem[]) ?? []);
      }
      if (niveauResult?.status.success) {
        setNiveauOptions(
          niveauResult.data.data.map((item: { id: string; nom: string }) => ({
            value: item.id,
            label: item.nom,
          })),
        );
      }
    };
    void loadReferentials();
  }, [etablissement_id]);

  const deviseOptions = useMemo(
    () =>
      buildReferentialOptions(referentialCatalog, "FINANCE_DEVISE", ["MGA", "EUR", "USD"]),
    [referentialCatalog],
  );

  const schema = useMemo(
    () =>
      z
        .object({
          etablissement_id: z.string().min(1, "L'etablissement est requis."),
          niveau_scolaire_id: z.preprocess(
            (value) => (typeof value === "string" && value.trim() === "" ? null : value),
            z.string().nullable().optional(),
          ),
          usage_scope: z.string().trim().min(1, "Le type d'usage est requis."),
          nom: z.string().trim().min(2, "Le nom du frais est requis.").max(120, "Nom trop long."),
          description: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value, z.string().max(240, "Description trop longue.").nullable().optional()),
          montant: z.coerce.number().min(0, "Le montant doit etre positif ou nul."),
          devise: z.string().trim().min(1, "La devise est requise."),
          nombre_tranches: z.coerce.number().int().min(1).default(1),
          mode_facturation: z.string().trim().min(1, "Le mode de facturation est requis."),
          est_recurrent: z.boolean().default(false),
          periodicite: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value, z.string().nullable().optional()),
          prorata_eligible: z.boolean().default(false),
          eligibilite_json: z.preprocess(
            (value) => (typeof value === "string" && value.trim() === "" ? null : value),
            z.string().nullable().optional(),
          ),
          plans_paiement_autorises_json: z.preprocess(
            (value) => (typeof value === "string" && value.trim() === "" ? null : value),
            z.string().nullable().optional(),
          ),
          plan_paiement_defaut_code: z.preprocess(
            (value) => (typeof value === "string" && value.trim() === "" ? null : value),
            z.string().nullable().optional(),
          ),
        })
        .superRefine((value, ctx) => {
          const usageScope = (value.usage_scope ?? "GENERAL").trim().toUpperCase();
          const modeFacturation = (value.mode_facturation ?? "PONCTUEL").trim().toUpperCase();

          if (modeFacturation === "RECURRENT" && !value.est_recurrent) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["est_recurrent"],
              message: "Active le caractere recurrent pour un frais de mode recurrent.",
            });
          }

          if (value.est_recurrent && !value.periodicite) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["periodicite"],
              message: "La periodicite est requise pour un frais recurrent.",
            });
          }
          if (value.prorata_eligible && (!value.est_recurrent || value.periodicite !== "monthly")) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["prorata_eligible"],
              message: "Le prorata n'est disponible que pour un frais recurrent mensuel.",
            });
          }
          if (usageScope === "SCOLARITE") {
            if (value.est_recurrent || modeFacturation === "RECURRENT") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["mode_facturation"],
                message: "La scolarite doit etre facturee en annuel, pas en recurrent.",
              });
            }
            if (value.periodicite) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["periodicite"],
                message: "La scolarite annuelle ne doit pas porter de periodicite recurrente.",
              });
            }
            if (value.prorata_eligible) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["prorata_eligible"],
                message: "Le prorata mensuel n'est pas compatible avec la scolarite annuelle.",
              });
            }
          }
          if (usageScope === "INSCRIPTION") {
            if (value.est_recurrent || modeFacturation === "RECURRENT") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["mode_facturation"],
                message: "Le droit d'inscription doit rester ponctuel et ne peut pas etre recurrent.",
              });
            }
            if (modeFacturation === "ANNUEL") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["mode_facturation"],
                message: "Le droit d'inscription reste ponctuel, meme lorsqu'il autorise quelques tranches.",
              });
            }
            if (value.periodicite) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["periodicite"],
                message: "Le droit d'inscription ponctuel ne porte pas de periodicite recurrente.",
              });
            }
            if (value.prorata_eligible) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["prorata_eligible"],
                message: "Le prorata n'est pas compatible avec le droit d'inscription.",
              });
            }
          }
          const paymentPlanMode =
            modeFacturation === "ANNUEL" || usageScope === "SCOLARITE" || usageScope === "INSCRIPTION";
          if (paymentPlanMode && value.plan_paiement_defaut_code && !value.plans_paiement_autorises_json) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["plans_paiement_autorises_json"],
              message: "Renseigne les plans autorises avant de choisir un code par defaut.",
            });
          }
          if (paymentPlanMode && value.plans_paiement_autorises_json && !value.plan_paiement_defaut_code) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["plan_paiement_defaut_code"],
              message: "Le code du plan par defaut est requis.",
            });
          }
          if (paymentPlanMode && value.plans_paiement_autorises_json && value.plan_paiement_defaut_code) {
            try {
              const parsed = JSON.parse(value.plans_paiement_autorises_json);
              if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new Error();
              }
              if (
                usageScope === "INSCRIPTION" &&
                parsed.some((entry) => {
                  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return true;
                  return Number((entry as { nombre_tranches?: unknown }).nombre_tranches ?? 0) > 3;
                })
              ) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: ["plans_paiement_autorises_json"],
                  message: "Le droit d'inscription ne doit pas depasser 3 tranches autorisees.",
                });
              }
              const defaultCode = value.plan_paiement_defaut_code.trim().toUpperCase();
              const exists = parsed.some((entry) => {
                if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
                return typeof (entry as { code?: unknown }).code === "string"
                  && (entry as { code: string }).code.trim().toUpperCase() === defaultCode;
              });
              if (!exists) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: ["plan_paiement_defaut_code"],
                  message: "Le code du plan annuel par defaut doit exister dans les plans saisis.",
                });
              }
            } catch {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["plans_paiement_autorises_json"],
                message: "Les plans autorises doivent etre un tableau JSON valide.",
              });
            }
          }
          if (value.plans_paiement_autorises_json && !paymentPlanMode) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["mode_facturation"],
              message: "Les plans autorises ne sont utiles que pour la scolarite annuelle ou le droit d'inscription encadre.",
            });
          }
          if (value.eligibilite_json) {
            try {
              const parsed = JSON.parse(value.eligibilite_json);
              if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                throw new Error();
              }
            } catch {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["eligibilite_json"],
                message: "Les regles d'eligibilite doivent etre un JSON valide.",
              });
            }
          }
        }),
    [],
  );

  const fields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(schema, {
        omit: [
          "etablissement_id",
          ...(["SCOLARITE", "INSCRIPTION"].includes(selectedUsageScope)
            ? ["est_recurrent", "periodicite", "prorata_eligible"]
            : []),
        ],
        metaByField: {
      usage_scope: {
        relation: {
          options: usageScopeOptions,
        },
        fieldProps: {
          className: "md:col-span-1",
          emptyLabel: "Choisir un usage",
          description:
            "Permet de rattacher le frais au bon usage metier: inscription, scolarite, options, extras, fournitures, examens, transport ou cantine.",
        },
      },
      niveau_scolaire_id: {
        relation: {
          options: [{ value: "", label: "Tous les niveaux / toutes les classes" }, ...niveauOptions],
        },
        fieldProps: {
          className: "md:col-span-1",
          emptyLabel: "Tous les niveaux / toutes les classes",
          description: "Si aucun niveau n'est choisi, le frais devient global et peut etre utilise pour toutes les classes.",
        },
      },
      nom: {
        fieldProps: {
          placeholder: "Ex: Frais de scolarite annuelle",
        },
      },
      description: {
        fieldProps: {
          className: "md:col-span-2",
          placeholder: "Ex: Frais principal applicable a tous les eleves de l'etablissement.",
        },
      },
      montant: {
        fieldProps: {
          placeholder: "Ex: 150000",
        },
      },
      devise: {
        relation: {
          options: deviseOptions,
        },
      },
      nombre_tranches: {
        fieldProps: {
          className: "md:col-span-1",
          placeholder: "Ex: 1",
          description:
            "Champ legacy de compatibilite. Pour les frais annuels, la vraie source devient le plan annuel par defaut.",
        },
      },
      mode_facturation: {
        relation: {
          options: modeFacturationOptions,
        },
        fieldProps: {
          className: "md:col-span-1",
          emptyLabel: "Choisir un mode",
          description:
            "Scolarite = annuel. Les frais recurrent restent reserves aux services ou abonnements periodiques.",
        },
      },
      periodicite: {
        relation: {
          options: periodiciteOptions,
        },
        fieldProps: {
          emptyLabel: "Aucune periodicite",
        },
      },
      prorata_eligible: {
        fieldProps: {
          className: "md:col-span-1",
          description:
            "Active le calcul automatique du prorata sur la premiere facture si l'eleve arrive en cours de mois.",
        },
      },
      eligibilite_json: {
        widget: "textarea",
        fieldProps: {
          className: "md:col-span-2",
          placeholder: '{"classe_ids":["..."],"eleve_ids":["..."]}',
          description:
            "Optionnel. Limite l'usage du frais a des classes ou eleves precis sous forme JSON.",
        },
      },
      plans_paiement_autorises_json: {
        widget: "textarea",
        fieldProps: {
          className: "md:col-span-2",
          placeholder:
            selectedUsageScope === "INSCRIPTION"
              ? defaultInscriptionPlans
              : defaultScolaritePlans,
          description:
            selectedUsageScope === "INSCRIPTION"
              ? "Pour un droit d'inscription, fournis un tableau JSON de plans courts autorises. Laisse vide pour reutiliser le preset standard 1X / 2X / 3X."
              : "Pour un frais annuel, fournis un tableau JSON de plans autorises. Laisse vide sur la scolarite pour reutiliser le preset annuel standard.",
        },
      },
      plan_paiement_defaut_code: {
        fieldProps: {
          className: "md:col-span-1",
          placeholder: selectedUsageScope === "INSCRIPTION" ? "Ex: 1X" : "Ex: 10X",
          description:
            selectedUsageScope === "INSCRIPTION"
              ? "Code du plan propose par defaut pour le droit d'inscription. Laisse vide pour reutiliser le preset standard."
              : "Code du plan annuel propose par defaut a l'inscription. Laisse vide avec la scolarite pour reutiliser le preset standard.",
        },
      },
    },
    labelByField: {
      usage_scope: "Usage du frais",
      niveau_scolaire_id: "Niveau scolaire",
      nom: "Nom",
      description: "Description",
      montant: "Montant",
      devise: "Devise",
      nombre_tranches: "Nombre de tranches legacy",
      mode_facturation: "Mode de facturation",
      est_recurrent: "Frais recurrent",
      periodicite: "Periodicite",
      prorata_eligible: "Prorata autorise",
      eligibilite_json: "Regles d'eligibilite (JSON)",
      plans_paiement_autorises_json: "Plans autorises (JSON)",
      plan_paiement_defaut_code: "Plan par defaut",
        },
      }),
    [deviseOptions, niveauOptions, schema, selectedUsageScope],
  );

  const handleCatalogueValuesChange = (data: Record<string, unknown>) => {
    const usageScope =
      typeof data?.usage_scope === "string" && data.usage_scope.trim()
        ? data.usage_scope.trim().toUpperCase()
        : "GENERAL";
    setSelectedUsageScope(usageScope);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">Nouveau frais catalogue</h3>
          <p className="text-sm leading-6 text-slate-500">
            Cree un tarif reutilisable. Le barème sera mis en attente puis devra etre approuve avant de pouvoir etre facture.
          </p>
        </div>

        <Form
          schema={schema}
          fields={fields}
          service={service}
          labelMessage="Catalogue de frais"
          onValuesChange={handleCatalogueValuesChange}
          initialValues={etablissement_id ? {
            etablissement_id,
            niveau_scolaire_id: "",
            usage_scope: "GENERAL",
            devise: "MGA",
            nombre_tranches: 1,
            mode_facturation: "PONCTUEL",
            est_recurrent: false,
            prorata_eligible: false,
            eligibilite_json: "",
            plans_paiement_autorises_json: "",
            plan_paiement_defaut_code: "",
          } : undefined}
          submitLabel="Enregistrer le frais"
          submitAlign="end"
        />
      </div>
    </div>
  );
}

export default CatalogueFraisForm;
