/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiFileText,
  FiHeart,
  FiBookOpen,
  FiClipboard,
  FiCreditCard,
  FiDownload,
  FiPaperclip,
  FiKey,
  FiMapPin,
  FiSettings,
  FiTrash2,
  FiShield,
  FiTruck,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { z } from "zod";
import { hasAccess } from "../../../../../components/components.build";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import {
  MultiStepFormWizard,
  type WizardStep,
} from "../../../../../components/Form/multistep/MultiStepFormWizard";
import { ProfilSchema } from "../../../../../generated/zod";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import EtablissementService, {
  type EnrollmentFinancePolicySettings,
} from "../../../../../services/etablissement.service";
import ReferencielService, {
  buildReferentialOptions,
  type ReferentialCatalogItem,
} from "../../../../../services/referenciel.service";
import type { StatutInscription } from "../../../../../types/models";
import { useInscriptionCreateStore } from "../../store/InscriptionCreateStore";
import InscriptionService from "../../../../../services/inscription.service";
import type { EnrollmentDraftPayload } from "../../../../../services/enrollmentDraft.service";

type WizardData = {
  eleve?: any;
  scolarite?: any;
  tuteur1?: any;
  tuteur2?: any;
  acces_systeme?: any;
  consentements?: any;
  documents?: any;
  medical?: any;
  historique_scolaire?: any;
  observations?: any;
  services?: any;
  finance?: any;
  echeancier?: any;
};

type EnrollmentFormMode = "RAPIDE" | "COMPLETE";

type InscriptionEditPayload = {
  eleve?: Record<string, unknown>;
  scolarite?: Record<string, unknown>;
  current_classe?: {
    id?: string | null;
    nom?: string | null;
    niveau?: string | null;
    site?: string | null;
  } | null;
  tuteur1?: Record<string, unknown>;
  tuteur2?: Record<string, unknown>;
  acces_systeme?: Record<string, unknown>;
  consentements?: Record<string, unknown>;
  medical?: Record<string, unknown>;
  historique_scolaire?: Record<string, unknown>;
  observations?: Record<string, unknown>;
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

type EnrollmentDocumentTypeOption = {
  id: string;
  code: string;
  nom: string;
  description?: string | null;
  obligatoire?: boolean;
  ordre?: number | null;
};

type PendingDocumentUpload = {
  contentBase64: string;
  fileName: string;
  mimeType: string | null;
  size: number;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inscriptionTypeOptions = [
  { value: "NOUVELLE_INSCRIPTION", label: "Nouvelle inscription" },
  { value: "REINSCRIPTION", label: "Reinscription" },
  { value: "TRANSFERT_ENTRANT", label: "Transfert entrant" },
  { value: "REDOUBLEMENT", label: "Redoublement" },
  { value: "PASSAGE_CLASSE_SUPERIEURE", label: "Passage en classe superieure" },
];
const inscriptionStatusOptions = [
  { value: "PREINSCRIT", label: "Preinscrit" },
  { value: "INSCRIT", label: "Inscrit" },
  { value: "EN_ATTENTE_PAIEMENT", label: "En attente de paiement" },
  { value: "VALIDEE", label: "Inscription validee" },
  { value: "DOSSIER_INCOMPLET", label: "Dossier incomplet" },
  { value: "TRANSFERE", label: "Transfere" },
  { value: "SUSPENDUE", label: "Suspendue" },
];
const paymentMethodOptions = [
  { value: "ESPECES", label: "Especes" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "VIREMENT_BANCAIRE", label: "Virement bancaire" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CARTE_BANCAIRE", label: "Carte bancaire" },
  { value: "AUTRE", label: "Autre" },
];

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function formatMoney(value: number, devise = "MGA") {
  return `${Number(value ?? 0).toLocaleString("fr-FR")} ${devise}`;
}

function addMonthsWithPaymentDay(
  baseDate: Date,
  monthOffset: number,
  paymentDay: number,
) {
  const safeDay = Math.max(1, Math.min(28, paymentDay));
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + monthOffset,
    safeDay,
  );
}

function parseBooleanLabel(value?: boolean) {
  return value ? "Oui" : "Non";
}

function hasTutorDraftData(tuteur: any) {
  if (!tuteur || typeof tuteur !== "object") return false;
  return Boolean(
    normalizeOptionalString(tuteur.parent_tuteur_id) ||
      normalizeOptionalString(tuteur.nom) ||
      normalizeOptionalString(tuteur.prenom) ||
      normalizeOptionalString(tuteur.telephone) ||
      normalizeOptionalString(tuteur.email),
  );
}

function getTutorDraftName(tuteur: any) {
  if (!tuteur || typeof tuteur !== "object") return "Responsable non renseigne";
  return (
    [
      normalizeOptionalString(tuteur.prenom),
      normalizeOptionalString(tuteur.nom),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    normalizeOptionalString(tuteur.nom_complet) ||
    "Responsable non renseigne"
  );
}

function splitParentName(
  option?: {
    prenom?: string | null;
    nom?: string | null;
    nom_complet?: string | null;
  } | null,
) {
  const prenom = normalizeOptionalString(option?.prenom);
  const nom = normalizeOptionalString(option?.nom);
  if (prenom || nom) {
    return { prenom: prenom ?? "", nom: nom ?? "" };
  }

  const fullName = normalizeOptionalString(option?.nom_complet);
  if (!fullName) {
    return { prenom: "", nom: "" };
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { prenom: "", nom: fullName };
  }

  return {
    prenom: parts.slice(0, -1).join(" "),
    nom: parts.slice(-1).join(" "),
  };
}

function matchesFeeScope(option: CatalogueFeeOption, scopes: string[]) {
  const scope = (option.usage_scope ?? "GENERAL").toUpperCase();
  return scopes.includes(scope);
}

function parsePaymentPlans(
  option?: CatalogueFeeOption | null,
): CataloguePaymentPlan[] {
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
      if (!entry || typeof entry !== "object" || Array.isArray(entry))
        return [];
      const plan = entry as Record<string, unknown>;
      const code =
        typeof plan.code === "string" ? plan.code.trim().toUpperCase() : "";
      const label = typeof plan.label === "string" ? plan.label.trim() : "";
      const nombreTranches = Number(plan.nombre_tranches ?? 0);
      const offsets = Array.isArray(plan.offsets_mois)
        ? plan.offsets_mois
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value >= 0)
        : [];
      if (
        !code ||
        !label ||
        !Number.isFinite(nombreTranches) ||
        nombreTranches < 1
      )
        return [];
      if (offsets.length !== Math.trunc(nombreTranches)) return [];
      return [
        {
          code,
          label,
          nombre_tranches: Math.trunc(nombreTranches),
          offsets_mois: offsets,
        },
      ];
    });
    if (normalized.length > 0) return normalized;
  }

  const fallbackCount = Math.max(1, Number(option.nombre_tranches ?? 1));
  return [
    {
      code:
        typeof option.plan_paiement_defaut_code === "string" &&
        option.plan_paiement_defaut_code.trim()
          ? option.plan_paiement_defaut_code.trim().toUpperCase()
          : `${fallbackCount}X`,
      label: fallbackCount === 1 ? "Comptant" : `${fallbackCount} tranches`,
      nombre_tranches: fallbackCount,
      offsets_mois: Array.from({ length: fallbackCount }, (_, index) => index),
    },
  ];
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Impossible de lire le fichier selectionne."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("La lecture du fichier a echoue."));
    reader.readAsDataURL(file);
  });
}

function asRecord(value: unknown): Record<string, any> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : undefined;
}

function splitName(fullName: unknown) {
  const normalized = typeof fullName === "string" ? fullName.trim() : "";
  if (!normalized) return { nom: "", prenom: "" };
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { nom: parts[0], prenom: "" };
  return {
    nom: parts[0],
    prenom: parts.slice(1).join(" "),
  };
}

function normalizeDraftGuardian(
  guardian: unknown,
  defaults: Record<string, unknown>,
) {
  const record = asRecord(guardian);
  if (!record) return defaults;
  const split = splitName(record.nom_complet ?? record.name);

  return {
    ...defaults,
    ...record,
    nom: record.nom ?? split.nom,
    prenom: record.prenom ?? split.prenom,
    telephone: record.telephone ?? record.phone ?? "",
    email: record.email ?? "",
    relation: record.relation ?? defaults.relation ?? "",
  };
}

function getDraftGuardians(draft?: {
  guardians_data?: Record<string, unknown> | null;
}) {
  const guardiansData = draft?.guardians_data;
  if (Array.isArray(guardiansData?.items)) {
    return guardiansData.items as Array<Record<string, unknown>>;
  }
  if (Array.isArray(guardiansData?.tuteurs)) {
    return guardiansData.tuteurs as Array<Record<string, unknown>>;
  }
  return [];
}

export default function InscriptionForm({
  mode = "create",
  inscriptionId,
  draft,
  onDraftAutosave,
  onDraftFinalize,
}: {
  mode?: "create" | "edit";
  inscriptionId?: string;
  draft?: EnrollmentDraftPayload & {
    id?: string;
    current_step?: number;
    draft_type?: string;
  };
  onDraftAutosave?: (payload: EnrollmentDraftPayload) => Promise<void>;
  onDraftFinalize?: (payload: EnrollmentDraftPayload) => Promise<string>;
}) {
  const navigate = useNavigate();
  const { etablissement_id, user, roles } = useAuth();
  const { info } = useInfo();
  const inscriptionService = useMemo(() => new InscriptionService(), []);
  const etablissementService = useMemo(() => new EtablissementService(), []);

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

  const classeOptions = useInscriptionCreateStore(
    (state) => state.classeOptions,
  );
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
  const remiseOptions = useInscriptionCreateStore(
    (state) => state.remiseOptions,
  );
  const parentTuteurOptions = useInscriptionCreateStore(
    (state) => state.parentTuteurOptions,
  );
  const niveauOptions = useInscriptionCreateStore(
    (state) => state.niveauOptions,
  );
  const anneeScolaireLabel = useInscriptionCreateStore(
    (state) => state.anneeScolaireLabel,
  );
  const scolariteInitialData = useInscriptionCreateStore(
    (state) => state.scolariteInitialData,
  );
  const [enrollmentFormMode, setEnrollmentFormMode] =
    useState<EnrollmentFormMode>("COMPLETE");
  const [selectedNiveauId, setSelectedNiveauId] = useState<string | null>(null);
  const [selectedTransportActive, setSelectedTransportActive] = useState(false);
  // const [selectedCantineActive, setSelectedCantineActive] = useState(false);
  const [selectedTransportLineId, setSelectedTransportLineId] = useState<
    string | null
  >(null);
  const [selectedInscriptionFeeId, setSelectedInscriptionFeeId] = useState<
    string | null
  >(null);
  const [selectedScolariteFeeId, setSelectedScolariteFeeId] = useState<
    string | null
  >(null);
  const [requiresPaymentDay, setRequiresPaymentDay] = useState(false);
  const [referentialCatalog, setReferentialCatalog] = useState<
    ReferentialCatalogItem[]
  >([]);
  const [loadingEditPayload, setLoadingEditPayload] = useState(mode === "edit");
  const [editPayload, setEditPayload] = useState<InscriptionEditPayload | null>(
    null,
  );
  const [selectedInscriptionType, setSelectedInscriptionType] =
    useState<string>("NOUVELLE_INSCRIPTION");
  const [documentTypeOptions, setDocumentTypeOptions] = useState<
    EnrollmentDocumentTypeOption[]
  >([]);
  const [documentChecklistValues, setDocumentChecklistValues] = useState<
    Record<string, boolean>
  >({});
  const [documentUploads, setDocumentUploads] = useState<
    Record<string, PendingDocumentUpload>
  >({});
  const [financeStepValues, setFinanceStepValues] = useState<
    Record<string, any>
  >({});
  const [echeancierStepValues, setEcheancierStepValues] = useState<
    Record<string, any>
  >({});
  const [tuteur1SyncValues, setTuteur1SyncValues] = useState<
    Record<string, any> | undefined
  >(undefined);
  const [tuteur2SyncValues, setTuteur2SyncValues] = useState<
    Record<string, any> | undefined
  >(undefined);
  const [lastSelectedTutor1ParentId, setLastSelectedTutor1ParentId] = useState<
    string | null
  >(null);
  const [lastSelectedTutor2ParentId, setLastSelectedTutor2ParentId] = useState<
    string | null
  >(null);
  const [enrollmentFinancePolicy, setEnrollmentFinancePolicy] =
    useState<EnrollmentFinancePolicySettings | null>(null);

  const canAccessDocumentTypeConfiguration = useMemo(() => {
    if (!user || !roles) return false;
    return hasAccess(user, roles, "DOC.INSCRIPTIONTYPES.PAGE");
  }, [roles, user]);

  useEffect(() => {
    if (etablissement_id) {
      void getInscriptionOptions(etablissement_id);
    }
  }, [etablissement_id, getInscriptionOptions]);

  useEffect(() => {
    let active = true;

    const loadEnrollmentFinancePolicy = async () => {
      if (!etablissement_id) {
        if (active) setEnrollmentFinancePolicy(null);
        return;
      }

      try {
        const result = await etablissementService.getEnrollmentFinancePolicy();
        if (!active) return;
        setEnrollmentFinancePolicy(
          (result?.data ?? null) as EnrollmentFinancePolicySettings | null,
        );
      } catch (error) {
        console.error(error);
        if (!active) return;
        setEnrollmentFinancePolicy(null);
      }
    };

    void loadEnrollmentFinancePolicy();

    return () => {
      active = false;
    };
  }, [etablissementService, etablissement_id]);

  useEffect(() => {
    let active = true;

    const loadEditPayload = async () => {
      if (mode !== "edit" || !inscriptionId) {
        if (active) setLoadingEditPayload(false);
        return;
      }

      setLoadingEditPayload(true);
      try {
        const result = await inscriptionService.getEditPayload(inscriptionId);
        if (!active) return;
        setEditPayload((result.data ?? null) as InscriptionEditPayload | null);
      } catch (error) {
        console.error(error);
        if (!active) return;
        info(
          "Impossible de charger les donnees d'edition de l'inscription.",
          "error",
        );
      } finally {
        if (active) setLoadingEditPayload(false);
      }
    };

    void loadEditPayload();

    return () => {
      active = false;
    };
  }, [info, inscriptionId, inscriptionService, mode]);

  useEffect(() => {
    let active = true;

    const loadDocumentTypes = async () => {
      if (mode !== "create" || !etablissement_id) {
        if (active) setDocumentTypeOptions([]);
        return;
      }

      try {
        const result = await inscriptionService.getDocumentTypes({
          etablissement_id,
          type_inscription: selectedInscriptionType,
        });
        if (!active) return;
        const nextOptions = Array.isArray(result?.data)
          ? (result.data as EnrollmentDocumentTypeOption[])
          : [];
        setDocumentTypeOptions(nextOptions);
      } catch (error) {
        console.error(error);
        if (!active) return;
        setDocumentTypeOptions([]);
        info(
          "Impossible de charger les documents d'inscription attendus.",
          "error",
        );
      }
    };

    void loadDocumentTypes();

    return () => {
      active = false;
    };
  }, [
    etablissement_id,
    info,
    inscriptionService,
    mode,
    selectedInscriptionType,
  ]);

  useEffect(() => {
    setDocumentUploads((prev) => {
      const allowedIds = new Set(documentTypeOptions.map((item) => item.id));
      const nextEntries = Object.entries(prev).filter(([key]) =>
        allowedIds.has(key),
      );
      if (nextEntries.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [documentTypeOptions]);

  useEffect(() => {
    setDocumentChecklistValues(
      (prev) =>
        Object.fromEntries(
          documentTypeOptions.map((item) => {
            const fieldName = `document_${item.id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
            return [fieldName, prev[fieldName] ?? false];
          }),
        ) as Record<string, boolean>,
    );
  }, [documentTypeOptions]);

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
      transportLineOptions.find(
        (option) => option.value === selectedTransportLineId,
      ) ?? null,
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

  const primaryTutorEmailFallback = useMemo(
    () => normalizeOptionalString(editPayload?.tuteur1?.email),
    [editPayload?.tuteur1?.email],
  );

  const filteredTransportStopOptions = useMemo(() => {
    if (!selectedTransportLineId) return transportStopOptions;
    return transportStopOptions.filter(
      (option) => option.ligne_transport_id === selectedTransportLineId,
    );
  }, [selectedTransportLineId, transportStopOptions]);

  const filteredClasseOptions = useMemo(() => {
    if (!selectedNiveauId) return classeOptions;
    return classeOptions.filter(
      (option) =>
        !option.niveau_scolaire_id ||
        option.niveau_scolaire_id === selectedNiveauId,
    );
  }, [classeOptions, selectedNiveauId]);

  const buildTutorSyncValues = useMemo(
    () =>
      (
        data: Record<string, any>,
        options: Array<{
          value: string;
          nom_complet?: string | null;
          prenom?: string | null;
          nom?: string | null;
          telephone?: string | null;
          telephone_secondaire?: string | null;
          email?: string | null;
          adresse?: string | null;
          profession?: string | null;
          lieu_travail?: string | null;
        }>,
        defaults: {
          est_principal: boolean;
          est_responsable_legal: boolean;
          est_responsable_financier: boolean;
          est_contact_urgence: boolean;
          autorise_recuperation: boolean;
        },
      ) => {
        const selectedParentId = normalizeOptionalString(
          data?.parent_tuteur_id,
        );
        if (!selectedParentId) return undefined;

        const selectedParent = options.find(
          (item) => item.value === selectedParentId,
        );
        if (!selectedParent) return undefined;

        const nameParts = splitParentName(selectedParent);
        return {
          nom: nameParts.nom,
          prenom: nameParts.prenom,
          telephone: selectedParent.telephone ?? "",
          telephone_secondaire: selectedParent.telephone_secondaire ?? "",
          email: selectedParent.email ?? "",
          adresse: selectedParent.adresse ?? "",
          profession: selectedParent.profession ?? "",
          lieu_travail: selectedParent.lieu_travail ?? "",
          est_principal:
            data?.est_principal == null
              ? defaults.est_principal
              : Boolean(data.est_principal),
          est_responsable_legal:
            data?.est_responsable_legal == null
              ? defaults.est_responsable_legal
              : Boolean(data.est_responsable_legal),
          est_responsable_financier:
            data?.est_responsable_financier == null
              ? defaults.est_responsable_financier
              : Boolean(data.est_responsable_financier),
          est_contact_urgence:
            data?.est_contact_urgence == null
              ? defaults.est_contact_urgence
              : Boolean(data.est_contact_urgence),
          autorise_recuperation:
            data?.autorise_recuperation == null
              ? defaults.autorise_recuperation
              : Boolean(data.autorise_recuperation),
        };
      },
    [],
  );

  const eleveSchema = useMemo(
    () =>
      ProfilSchema.omit({
        id: true,
        created_at: true,
        updated_at: true,
        utilisateur_id: true,
        contact_urgence_json: true,
      }).extend({
        lieu_naissance: z.string().optional().nullable(),
        nationalite: z.string().optional().nullable(),
        photo_url: z.string().optional().nullable(),
        telephone_eleve: z.string().optional().nullable(),
        email_eleve: z
          .string()
          .optional()
          .nullable()
          .refine((value) => !value || emailRegex.test(value), {
            message: "Renseigne un email eleve valide.",
          }),
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
          lieu_naissance: "Lieu de naissance",
          nationalite: "Nationalite",
          genre: "Genre",
          photo_url: "Photo (URL)",
          adresse: "Adresse",
          telephone_eleve: "Telephone de l'eleve",
          email_eleve: "Email de l'eleve",
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
              description:
                "Nom de famille utilise pour les dossiers scolaires.",
            },
          },
          date_naissance: {
            dateMode: "date",
            fieldProps: {
              className: "md:col-span-1",
              description:
                "La date de naissance sera reprise dans la fiche eleve.",
            },
          },
          lieu_naissance: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Ville ou commune de naissance",
            },
          },
          nationalite: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Nationalite de l'eleve",
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
          photo_url: {
            fieldProps: {
              className: "md:col-span-2",
              placeholder:
                "Lien vers une photo d'identite ou image deja disponible",
              description:
                "Tu peux renseigner une URL ou un chemin deja publie. L'upload photo direct pourra etre branche ensuite.",
            },
          },
          adresse: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder: "Adresse de residence de l'eleve",
              description:
                "Utile pour le suivi administratif et la communication.",
            },
          },
          telephone_eleve: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Optionnel selon l'age",
            },
          },
          email_eleve: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Optionnel selon l'age",
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
              description:
                "Numero prioritaire si le parent principal est indisponible.",
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
        niveau_scolaire_id:
          mode === "create"
            ? z.string().min(1, "Selectionnez un niveau")
            : z.string().optional().nullable(),
        classe_id: z.string().optional().nullable(),
        date_entree: z.coerce.date().nullable(),
        date_inscription: z.coerce.date(),
        statut_inscription: z.string().default("INSCRIT"),
        type_inscription: z.string().default("NOUVELLE_INSCRIPTION"),
      }),
    [mode],
  );

  const scolariteFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(scolariteSchema, {
        labelByField: {
          code_eleve: "Code eleve",
          niveau_scolaire_id: "Niveau demande",
          classe_id: "Classe souhaitee / affectee",
          date_entree: "Date d'entree",
          date_inscription: "Date d'inscription",
          statut_inscription: "Statut d'inscription",
          type_inscription: "Type d'inscription",
        },
        metaByField: {
          code_eleve: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Code genere automatiquement",
              description:
                "Vous pouvez le conserver ou l'ajuster avant validation.",
            },
          },
          niveau_scolaire_id: {
            relation: { options: niveauOptions },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir un niveau",
              description:
                mode === "create"
                  ? "Le niveau demande est obligatoire, meme si aucune classe n'est encore affectee."
                  : "Le niveau du dossier est repris depuis l'inscription actuelle.",
              disabled: mode === "edit",
            },
          },
          classe_id: {
            relation: { options: filteredClasseOptions },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir une classe si disponible",
              description:
                mode === "create"
                  ? "Optionnel pour une inscription rapide ou si l'affectation se fera plus tard."
                  : "Le changement de classe se fait depuis l'action dediee du resume pour conserver la regularisation financiere.",
              disabled: mode === "edit",
            },
          },
          type_inscription: {
            relation: {
              options: inscriptionTypeOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Selectionner",
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
              options: inscriptionStatusOptions,
            },
            fieldProps: {
              className: "md:col-span-2",
              emptyLabel: "Selectionner",
              description:
                mode === "create"
                  ? "La creation initiale ouvre directement un dossier inscrit."
                  : "Les annulations et clotures definitives passent par leurs actions dediees.",
            },
          },
        },
      }),
    [filteredClasseOptions, mode, niveauOptions, scolariteSchema],
  );

  const tuteur1Schema = useMemo(
    () =>
      z
        .object({
          parent_tuteur_id: z.string().optional().nullable(),
          nom: z.string().optional().nullable(),
          prenom: z.string().optional().nullable(),
          telephone: z.string().optional().nullable(),
          telephone_secondaire: z.string().optional().nullable(),
          email: z
            .string()
            .optional()
            .nullable()
            .refine((value) => !value || emailRegex.test(value), {
              message: "Format d'email incorrect.",
            }),
          adresse: z.string().optional().nullable(),
          profession: z.string().optional().nullable(),
          lieu_travail: z.string().optional().nullable(),
          relation: z.string().min(1, "Champ requis"),
          est_principal: z.boolean().default(true),
          est_responsable_legal: z.boolean().default(true),
          est_responsable_financier: z.boolean().default(true),
          est_contact_urgence: z.boolean().default(true),
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
          telephone_secondaire: "Telephone secondaire",
          email: "Email",
          adresse: "Adresse",
          profession: "Profession",
          lieu_travail: "Lieu de travail",
          relation: "Lien avec l'eleve",
          est_principal: "Tuteur principal",
          est_responsable_legal: "Responsable legal",
          est_responsable_financier: "Responsable financier",
          est_contact_urgence: "Contact d'urgence",
          autorise_recuperation: "Autorise a recuperer l'eleve",
        },
        metaByField: {
          parent_tuteur_id: {
            relation: {
              options: [
                { value: "", label: "Nouveau parent / tuteur" },
                ...parentTuteurOptions,
              ],
            },
            fieldProps: {
              className: "md:col-span-2",
              emptyLabel: "Selectionner",
              description:
                "Selectionne un parent deja enregistre pour rattacher automatiquement la fratrie.",
            },
          },
          nom: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Nom du parent ou tuteur principal",
              description:
                "A remplir seulement si aucun parent existant n'est selectionne.",
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
          telephone_secondaire: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Numero secondaire ou WhatsApp",
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
          profession: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Profession du responsable",
            },
          },
          lieu_travail: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Lieu de travail ou employeur",
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
              description:
                "Activez ce champ pour definir le contact principal du dossier.",
            },
          },
          est_responsable_legal: {
            fieldProps: {
              className: "md:col-span-1",
            },
          },
          est_responsable_financier: {
            fieldProps: {
              className: "md:col-span-1",
              description:
                "Obligatoire si des frais sont enregistres sur l'inscription.",
            },
          },
          est_contact_urgence: {
            fieldProps: {
              className: "md:col-span-1",
            },
          },
          autorise_recuperation: {
            fieldProps: {
              className: "md:col-span-1",
              description:
                "Autorise ce tuteur a recuperer l'eleve a la sortie.",
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
        telephone_secondaire: z.string().optional().nullable(),
        email: z
          .string()
          .optional()
          .nullable()
          .refine((value) => !value || emailRegex.test(value), {
            message: "Format d'email incorrect.",
          }),
        adresse: z.string().optional().nullable(),
        profession: z.string().optional().nullable(),
        lieu_travail: z.string().optional().nullable(),
        relation: z.string().optional().nullable(),
        est_principal: z.boolean().default(false),
        est_responsable_legal: z.boolean().default(false),
        est_responsable_financier: z.boolean().default(false),
        est_contact_urgence: z.boolean().default(false),
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
          telephone_secondaire: "Telephone secondaire",
          email: "Email",
          adresse: "Adresse",
          profession: "Profession",
          lieu_travail: "Lieu de travail",
          relation: "Lien avec l'eleve",
          est_principal: "Tuteur principal",
          est_responsable_legal: "Responsable legal",
          est_responsable_financier: "Responsable financier",
          est_contact_urgence: "Contact d'urgence",
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
              description:
                "Pratique pour retrouver la meme mere, le meme pere ou un tuteur deja connu.",
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
          telephone_secondaire: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Numero secondaire additionnel",
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
          profession: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Profession du second responsable",
            },
          },
          lieu_travail: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Lieu de travail ou employeur",
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
          est_responsable_legal: {
            fieldProps: {
              className: "md:col-span-1",
            },
          },
          est_responsable_financier: {
            fieldProps: {
              className: "md:col-span-1",
            },
          },
          est_contact_urgence: {
            fieldProps: {
              className: "md:col-span-1",
            },
          },
          autorise_recuperation: {
            fieldProps: {
              className: "md:col-span-1",
            },
          },
        },
      }),
    [parentTuteurOptions, relationOptions, tuteur2Schema],
  );

  const documentFieldEntries = useMemo(
    () =>
      documentTypeOptions.map((item) => ({
        ...item,
        fieldName: `document_${item.id.replace(/[^a-zA-Z0-9_]/g, "_")}`,
      })),
    [documentTypeOptions],
  );

  const documentsSchema = useMemo(() => {
    const shape = Object.fromEntries(
      documentFieldEntries.map((item) => [
        item.fieldName,
        z.boolean().default(false),
      ]),
    ) as Record<string, z.ZodDefault<z.ZodBoolean>>;

    return z.object(shape);
  }, [documentFieldEntries]);

  const documentsFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(documentsSchema, {
        labelByField: Object.fromEntries(
          documentFieldEntries.map((item) => [item.fieldName, item.nom]),
        ),
        metaByField: Object.fromEntries(
          documentFieldEntries.map((item) => [
            item.fieldName,
            {
              fieldProps: {
                className: "md:col-span-2",
                description: `${
                  item.obligatoire
                    ? "Document obligatoire"
                    : "Document optionnel"
                }${item.description ? ` - ${item.description}` : ""}`,
              },
            },
          ]),
        ),
      }),
    [documentFieldEntries, documentsSchema],
  );

  const medicalSchema = useMemo(
    () =>
      z.object({
        groupe_sanguin: z.string().optional().nullable(),
        allergies: z.string().optional().nullable(),
        maladies_particulieres: z.string().optional().nullable(),
        traitement_medical: z.string().optional().nullable(),
        medecin_traitant: z.string().optional().nullable(),
        telephone_medecin: z.string().optional().nullable(),
        autorisation_prise_en_charge_medicale: z.boolean().default(false),
        personne_a_contacter_urgence: z.string().optional().nullable(),
        telephone_urgence: z.string().optional().nullable(),
      }),
    [],
  );

  const medicalFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(medicalSchema, {
        labelByField: {
          groupe_sanguin: "Groupe sanguin",
          allergies: "Allergies",
          maladies_particulieres: "Maladies particulieres",
          traitement_medical: "Traitement medical",
          medecin_traitant: "Medecin traitant",
          telephone_medecin: "Telephone du medecin",
          autorisation_prise_en_charge_medicale:
            "Autorisation de prise en charge medicale",
          personne_a_contacter_urgence: "Personne a contacter en urgence",
          telephone_urgence: "Telephone d'urgence",
        },
        metaByField: {
          groupe_sanguin: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Ex: O+, A-...",
            },
          },
          allergies: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Allergies connues ou alimentation a surveiller",
            },
          },
          maladies_particulieres: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Antecedents, pathologies, vigilance particuliere",
            },
          },
          traitement_medical: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-1",
              placeholder:
                "Traitement en cours, posologie utile a l'etablissement",
            },
          },
          medecin_traitant: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Nom du medecin traitant",
            },
          },
          telephone_medecin: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Numero du medecin ou cabinet",
            },
          },
          autorisation_prise_en_charge_medicale: {
            fieldProps: {
              className: "md:col-span-2",
              description:
                "Autorise l'etablissement a engager la prise en charge medicale en cas d'urgence.",
            },
          },
          personne_a_contacter_urgence: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Nom de la personne a prevenir",
            },
          },
          telephone_urgence: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Numero d'urgence medicale ou familiale",
            },
          },
        },
      }),
    [medicalSchema],
  );

  const historiqueScolaireSchema = useMemo(
    () =>
      z.object({
        ancien_etablissement: z.string().optional().nullable(),
        ancienne_classe: z.string().optional().nullable(),
        annee_precedente: z.string().optional().nullable(),
        derniere_moyenne: z.coerce.number().optional().nullable(),
        decision_precedente: z.string().optional().nullable(),
        mention_precedente: z.string().optional().nullable(),
        motif_transfert: z.string().optional().nullable(),
        observations: z.string().optional().nullable(),
        reprise_auto: z.boolean().default(false),
      }),
    [],
  );

  const historiqueScolaireFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(historiqueScolaireSchema, {
        labelByField: {
          ancien_etablissement: "Ancien etablissement",
          ancienne_classe: "Ancienne classe",
          annee_precedente: "Annee scolaire precedente",
          derniere_moyenne: "Derniere moyenne",
          decision_precedente: "Decision precedente",
          mention_precedente: "Mention precedente",
          motif_transfert: "Motif de transfert",
          observations: "Observations scolaires",
          reprise_auto: "Reprise automatique des donnees precedentes",
        },
        metaByField: {
          ancien_etablissement: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Nom de l'ancien etablissement",
            },
          },
          ancienne_classe: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Derniere classe frequentee",
            },
          },
          annee_precedente: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Ex: 2025-2026",
            },
          },
          derniere_moyenne: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Ex: 12.5",
            },
          },
          decision_precedente: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Admis, redoublement, transfert...",
            },
          },
          mention_precedente: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Assez bien, bien, tres bien...",
            },
          },
          motif_transfert: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder:
                "Raison du changement d'etablissement ou d'affectation",
            },
          },
          observations: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder: "Notes pedagogiques utiles a la nouvelle equipe",
            },
          },
          reprise_auto: {
            fieldProps: {
              className: "md:col-span-2",
              description:
                "A cocher si ce dossier reprend volontairement l'historique de l'annee precedente.",
            },
          },
        },
      }),
    [historiqueScolaireSchema],
  );

  const accesSystemeSchema = useMemo(
    () =>
      z
        .object({
          creer_compte_parent: z.boolean().default(false),
          creer_compte_eleve: z.boolean().default(false),
          email_connexion_parent: z
            .string()
            .optional()
            .nullable()
            .refine((value) => !value || emailRegex.test(value), {
              message: "Format d'email incorrect.",
            }),
          identifiant_connexion_eleve: z.string().optional().nullable(),
          methode_envoi_identifiants: z.string().default("EMAIL"),
          envoyer_identifiants_apres_validation: z.boolean().default(true),
        })
        .superRefine((data, ctx) => {
          if (
            data.creer_compte_parent &&
            !normalizeOptionalString(data.email_connexion_parent) &&
            !primaryTutorEmailFallback
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["email_connexion_parent"],
              message:
                "Un email du responsable est necessaire pour ouvrir un compte parent.",
            });
          }
        }),
    [primaryTutorEmailFallback],
  );

  const accesSystemeFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(accesSystemeSchema, {
        labelByField: {
          creer_compte_parent: "Creer un compte parent",
          creer_compte_eleve: "Activer un compte eleve",
          email_connexion_parent: "Email de connexion parent",
          identifiant_connexion_eleve: "Identifiant de connexion eleve",
          methode_envoi_identifiants: "Methode d'envoi des identifiants",
          envoyer_identifiants_apres_validation:
            "Envoyer les identifiants apres validation",
        },
        metaByField: {
          creer_compte_parent: {
            fieldProps: {
              className: "md:col-span-2",
              description:
                "Le compte parent est cree pour le tuteur principal. Son email servira a la connexion.",
            },
          },
          creer_compte_eleve: {
            fieldProps: {
              className: "md:col-span-2",
              description:
                "L'eleve a toujours un profil interne, mais cette option active ou desactive son acces de connexion.",
            },
          },
          email_connexion_parent: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "parent@exemple.com",
              description:
                "Si vide, l'email du tuteur principal sera reutilise.",
            },
          },
          identifiant_connexion_eleve: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Ex: ELE-2026-0042",
              description:
                "Si vide, le code eleve sera utilise comme identifiant de connexion.",
            },
          },
          methode_envoi_identifiants: {
            relation: {
              options: [
                { value: "EMAIL", label: "Email" },
                { value: "SMS", label: "SMS" },
                { value: "IMPRESSION", label: "Impression papier" },
              ],
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir",
              description:
                "Le canal est memorise dans le dossier, meme si l'envoi automatique n'est pas encore branche.",
            },
          },
          envoyer_identifiants_apres_validation: {
            fieldProps: {
              className: "md:col-span-1",
              description:
                "Permet de preparer la diffusion des identifiants uniquement une fois l'inscription validee.",
            },
          },
        },
      }),
    [accesSystemeSchema],
  );

  const consentementsSchema = useMemo(
    () =>
      z
        .object({
          autorisation_sortie: z.boolean().default(false),
          autorisation_photo_video: z.boolean().default(false),
          autorisation_activite_scolaire: z.boolean().default(false),
          autorisation_prise_en_charge_medicale: z.boolean().default(false),
          acceptation_reglement_interieur: z.boolean().default(false),
          acceptation_conditions_financieres: z.boolean().default(false),
          date_acceptation: z.coerce.date().optional().nullable(),
          signataire_nom: z.string().optional().nullable(),
          commentaire: z.string().optional().nullable(),
        })
        .superRefine((data, ctx) => {
          if (
            (selectedInscriptionFeeId || selectedScolariteFeeId) &&
            !data.acceptation_conditions_financieres
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["acceptation_conditions_financieres"],
              message:
                "L'acceptation des conditions financieres est requise si des frais sont saisis.",
            });
          }
        }),
    [selectedInscriptionFeeId, selectedScolariteFeeId],
  );

  const consentementsFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(consentementsSchema, {
        labelByField: {
          autorisation_sortie: "Autorisation de sortie",
          autorisation_photo_video: "Autorisation photo ou video",
          autorisation_activite_scolaire: "Autorisation d'activite scolaire",
          autorisation_prise_en_charge_medicale:
            "Autorisation de prise en charge medicale",
          acceptation_reglement_interieur: "Acceptation du reglement interieur",
          acceptation_conditions_financieres:
            "Acceptation des conditions financieres",
          date_acceptation: "Date d'acceptation",
          signataire_nom: "Nom du signataire",
          commentaire: "Commentaire",
        },
        metaByField: {
          autorisation_sortie: { fieldProps: { className: "md:col-span-1" } },
          autorisation_photo_video: {
            fieldProps: { className: "md:col-span-1" },
          },
          autorisation_activite_scolaire: {
            fieldProps: { className: "md:col-span-1" },
          },
          autorisation_prise_en_charge_medicale: {
            fieldProps: { className: "md:col-span-1" },
          },
          acceptation_reglement_interieur: {
            fieldProps: { className: "md:col-span-1" },
          },
          acceptation_conditions_financieres: {
            fieldProps: {
              className: "md:col-span-1",
              description:
                "Devient obligatoire quand des frais sont enregistres pendant l'inscription.",
            },
          },
          date_acceptation: {
            dateMode: "date",
            fieldProps: { className: "md:col-span-1" },
          },
          signataire_nom: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Nom du parent, tuteur ou signataire",
            },
          },
          commentaire: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder:
                "Precisions ou reservation sur les autorisations accordees",
            },
          },
        },
      }),
    [consentementsSchema],
  );

  const observationsSchema = useMemo(
    () =>
      z.object({
        observation_administrative: z.string().optional().nullable(),
        observation_pedagogique: z.string().optional().nullable(),
        observation_financiere: z.string().optional().nullable(),
        note_interne: z.string().optional().nullable(),
      }),
    [],
  );

  const observationsFields = useMemo(
    () =>
      getFieldsFromZodObjectSchema(observationsSchema, {
        labelByField: {
          observation_administrative: "Observation administrative",
          observation_pedagogique: "Observation pedagogique",
          observation_financiere: "Observation financiere",
          note_interne: "Note interne",
        },
        metaByField: {
          observation_administrative: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder:
                "Elements a suivre par la scolarite ou le secretariat",
            },
          },
          observation_pedagogique: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder: "Informations utiles a l'equipe pedagogique",
            },
          },
          observation_financiere: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder:
                "Engagements, modalites ou vigilance particuliere sur la facturation",
            },
          },
          note_interne: {
            widget: "textarea",
            fieldProps: {
              className: "md:col-span-2",
              placeholder: "Note interne reservee aux utilisateurs autorises",
            },
          },
        },
      }),
    [observationsSchema],
  );

  const handleDocumentFileChange = async (
    documentTypeId: string,
    file: File | null,
  ) => {
    if (!file) {
      setDocumentUploads((prev) => {
        const next = { ...prev };
        delete next[documentTypeId];
        return next;
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      info("Le fichier depasse la limite de 10 Mo.", "error");
      return;
    }

    try {
      const contentBase64 = await fileToBase64(file);
      setDocumentUploads((prev) => ({
        ...prev,
        [documentTypeId]: {
          contentBase64,
          fileName: file.name,
          mimeType: file.type || null,
          size: file.size,
        },
      }));
    } catch (error) {
      info(error, "error");
    }
  };

  const documentsSupplementary = useMemo(() => {
    if (documentFieldEntries.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          Aucun type de document n'est configure pour ce type d'inscription.
        </div>
      );
    }

    const getDocumentDeclaredProvided = (
      fieldName: string,
      documentTypeId: string,
    ) =>
      Boolean(documentChecklistValues[fieldName]) ||
      Boolean(documentUploads[documentTypeId]);

    const requiredDocuments = documentFieldEntries.filter(
      (item) => item.obligatoire,
    );
    const providedDocuments = documentFieldEntries.filter((item) =>
      getDocumentDeclaredProvided(item.fieldName, item.id),
    );
    const missingRequiredDocuments = requiredDocuments.filter(
      (item) => !getDocumentDeclaredProvided(item.fieldName, item.id),
    );

    return (
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Pieces jointes immediates
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Tu peux deja televerser les fichiers disponibles. Ils seront
                lies au dossier des la creation.
              </p>
            </div>
            {canAccessDocumentTypeConfiguration ? (
              <button
                type="button"
                onClick={() => navigate("/documents/types-inscription")}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              >
                <FiSettings className="h-4 w-4" />
                Configurer les types
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {providedDocuments.length}/{documentFieldEntries.length} documents
              declares
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                missingRequiredDocuments.length > 0
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {missingRequiredDocuments.length > 0
                ? `${missingRequiredDocuments.length} obligatoire(s) manquant(s)`
                : "Tous les obligatoires sont couverts"}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          {documentFieldEntries.map((item) => {
            const pendingUpload = documentUploads[item.id];
            const isProvided = getDocumentDeclaredProvided(
              item.fieldName,
              item.id,
            );
            const statusLabel = isProvided
              ? "Fourni"
              : item.obligatoire
                ? "Manquant"
                : "Optionnel";
            const statusClassName = isProvided
              ? "bg-emerald-100 text-emerald-800"
              : item.obligatoire
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-700";
            return (
              <div
                key={`upload-${item.id}`}
                className={`rounded-2xl border px-4 py-4 ${
                  isProvided
                    ? "border-emerald-200 bg-emerald-50/40"
                    : item.obligatoire
                      ? "border-amber-200 bg-amber-50/40"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.nom}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClassName}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.obligatoire ? "Obligatoire" : "Optionnel"}
                      {item.description ? ` - ${item.description}` : ""}
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                    <FiPaperclip />
                    <span>Choisir un fichier</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const selectedFile = event.target.files?.[0] ?? null;
                        void handleDocumentFileChange(item.id, selectedFile);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                {pendingUpload ? (
                  <div className="mt-3 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                    <div className="flex flex-wrap items-center gap-3">
                      <FiDownload className="shrink-0" />
                      <span className="font-medium">
                        {pendingUpload.fileName}
                      </span>
                      <span className="text-emerald-700">
                        {(pendingUpload.size / 1024).toFixed(1)} Ko
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void handleDocumentFileChange(item.id, null)
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <FiTrash2 />
                        Retirer
                      </button>
                    </div>
                    {pendingUpload.mimeType?.startsWith("image/") ? (
                      <img
                        src={pendingUpload.contentBase64}
                        alt={pendingUpload.fileName}
                        className="max-h-44 rounded-xl border border-emerald-200 object-contain bg-white"
                      />
                    ) : (
                      <a
                        href={pendingUpload.contentBase64}
                        target="_blank"
                        rel="noreferrer"
                        download={pendingUpload.fileName}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                      >
                        <FiDownload />
                        Ouvrir l'aperçu local
                      </a>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [
    canAccessDocumentTypeConfiguration,
    documentChecklistValues,
    documentFieldEntries,
    documentUploads,
    navigate,
  ]);

  const servicesSchema = useMemo(
    () =>
      z
        .object({
          transport_active: z.boolean().default(false),
          transport_mode_facturation: z
            .literal("SERVICE_ONLY")
            .default("SERVICE_ONLY"),
          ligne_transport_id: z.string().optional().nullable(),
          arret_transport_id: z.string().optional().nullable(),
          zone_transport: z.string().optional().nullable(),
          date_debut_service: z.coerce.date().optional().nullable(),
          date_fin_service: z.coerce.date().optional().nullable(),
          cantine_active: z.boolean().default(false),
          cantine_mode_facturation: z
            .literal("SERVICE_ONLY")
            .default("SERVICE_ONLY"),
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
              description:
                "Creera un abonnement transport pour l'annee scolaire active.",
            },
          },
          ligne_transport_id: {
            relation: { options: transportLineOptions },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir une ligne",
              description: !selectedTransportActive
                ? "Active d'abord le transport pour rattacher une ligne."
                : selectedTransportLine &&
                    selectedTransportLine.inscriptions_ouvertes === false
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
              description:
                "Creera un abonnement cantine sur le dossier de l'eleve.",
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
        option.niveau_scolaire_id === selectedNiveauId ||
        !option.niveau_scolaire_id,
    );
  }, [catalogueFraisOptions, selectedNiveauId]);

  const inscriptionFeeOptions = useMemo(() => {
    return filteredCatalogueFraisOptions.filter((option) => {
      if (
        !matchesFeeScope(option as CatalogueFeeOption, [
          "GENERAL",
          "INSCRIPTION",
        ])
      ) {
        return false;
      }
      const feeOption = option as CatalogueFeeOption;
      const isInscriptionScope =
        (feeOption.usage_scope ?? "GENERAL").toUpperCase() === "INSCRIPTION";
      if (!isInscriptionScope) return true;
      return (
        (feeOption.mode_facturation ?? "").toUpperCase() === "PONCTUEL" ||
        !feeOption.est_recurrent
      );
    });
  }, [filteredCatalogueFraisOptions]);

  const selectedInscriptionFee = useMemo(
    () =>
      inscriptionFeeOptions.find(
        (option) => option.value === selectedInscriptionFeeId,
      ) ?? null,
    [inscriptionFeeOptions, selectedInscriptionFeeId],
  );

  const selectedInscriptionPaymentPlans = useMemo(
    () =>
      parsePaymentPlans(selectedInscriptionFee as CatalogueFeeOption | null),
    [selectedInscriptionFee],
  );

  const selectedInscriptionPlan = useMemo(() => {
    const selectedCode = normalizeOptionalString(
      financeStepValues?.catalogue_frais_inscription_plan_code,
    );
    return (
      selectedInscriptionPaymentPlans.find(
        (plan) => plan.code === (selectedCode ?? "").toUpperCase(),
      ) ?? null
    );
  }, [
    financeStepValues?.catalogue_frais_inscription_plan_code,
    selectedInscriptionPaymentPlans,
  ]);

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
        if (
          !matchesFeeScope(option as CatalogueFeeOption, [
            "GENERAL",
            "SCOLARITE",
          ])
        ) {
          return false;
        }
        const feeOption = option as CatalogueFeeOption;
        const isScolariteScope =
          (feeOption.usage_scope ?? "GENERAL").toUpperCase() === "SCOLARITE";
        if (!isScolariteScope) return true;
        return (
          (feeOption.mode_facturation ?? "").toUpperCase() === "ANNUEL" ||
          !feeOption.est_recurrent
        );
      }),
    [filteredCatalogueFraisOptions],
  );

  const selectedScolariteFee = useMemo(
    () =>
      scolariteFeeOptions.find(
        (option) => option.value === selectedScolariteFeeId,
      ) ?? null,
    [scolariteFeeOptions, selectedScolariteFeeId],
  );

  const selectedScolaritePaymentPlans = useMemo(
    () => parsePaymentPlans(selectedScolariteFee as CatalogueFeeOption | null),
    [selectedScolariteFee],
  );

  const selectedScolaritePlan = useMemo(() => {
    const selectedCode = normalizeOptionalString(
      financeStepValues?.catalogue_frais_scolarite_plan_code,
    );
    return (
      selectedScolaritePaymentPlans.find(
        (plan) => plan.code === (selectedCode ?? "").toUpperCase(),
      ) ?? null
    );
  }, [
    financeStepValues?.catalogue_frais_scolarite_plan_code,
    selectedScolaritePaymentPlans,
  ]);

  const scolaritePlanOptions = useMemo(
    () =>
      selectedScolaritePaymentPlans.map((plan) => ({
        value: plan.code,
        label: `${plan.label} - ${plan.nombre_tranches} tranche${plan.nombre_tranches > 1 ? "s" : ""}`,
      })),
    [selectedScolaritePaymentPlans],
  );

  const selectedRemise = useMemo(() => {
    const remiseId = normalizeOptionalString(financeStepValues?.remise_id);
    if (!remiseId) return null;
    return remiseOptions.find((option) => option.value === remiseId) ?? null;
  }, [financeStepValues?.remise_id, remiseOptions]);

  const financeEstimate = useMemo(() => {
    const devise =
      selectedInscriptionFee?.devise ?? selectedScolariteFee?.devise ?? "MGA";
    const registrationGross = Number(selectedInscriptionFee?.montant ?? 0);
    const schoolGross = Number(selectedScolariteFee?.montant ?? 0);
    const grossTotal = Number(registrationGross + schoolGross);
    const appliedRemiseType =
      selectedRemise?.type ?? financeStepValues?.remise_type ?? "AUCUNE";
    const appliedRemiseValue = Number(
      selectedRemise?.valeur ?? financeStepValues?.remise_valeur ?? 0,
    );
    let discountAmount = 0;
    if (appliedRemiseType === "PERCENT") {
      discountAmount = grossTotal * (Math.max(0, appliedRemiseValue) / 100);
    } else if (appliedRemiseType === "FIXED") {
      discountAmount = appliedRemiseValue;
    }
    discountAmount = Math.max(0, Math.min(grossTotal, Number(discountAmount)));
    const registrationDiscount =
      grossTotal > 0 ? (discountAmount * registrationGross) / grossTotal : 0;
    const schoolDiscount =
      grossTotal > 0 ? (discountAmount * schoolGross) / grossTotal : 0;
    const registrationNet = Math.max(
      0,
      registrationGross - registrationDiscount,
    );
    const schoolNet = Math.max(0, schoolGross - schoolDiscount);
    const netTotal = Math.max(0, grossTotal - discountAmount);
    const initialPaymentAmount = Math.max(
      0,
      Math.min(netTotal, Number(financeStepValues?.montant_paye_initial ?? 0)),
    );
    const remainingAmount = Math.max(0, netTotal - initialPaymentAmount);

    return {
      devise,
      grossTotal,
      discountAmount,
      registrationNet,
      schoolNet,
      netTotal,
      initialPaymentAmount,
      remainingAmount,
      hasAnyFee: grossTotal > 0,
      selectedFeeCount: [selectedInscriptionFee, selectedScolariteFee].filter(
        Boolean,
      ).length,
    };
  }, [
    financeStepValues?.montant_paye_initial,
    financeStepValues?.remise_type,
    financeStepValues?.remise_valeur,
    selectedInscriptionFee,
    selectedRemise,
    selectedScolariteFee,
  ]);

  const minimumPaymentPreview = useMemo(() => {
    const policy = enrollmentFinancePolicy;
    if (!policy) {
      return {
        requiredAmount: 0,
        missingAmount: 0,
        satisfied: true,
        description: "Politique de validation financiere non chargee.",
      };
    }

    let requiredAmount = 0;
    if (policy.mode === "PERCENT") {
      requiredAmount =
        financeEstimate.netTotal * (Math.max(0, policy.value) / 100);
    } else if (policy.mode === "AMOUNT") {
      requiredAmount = Math.min(
        financeEstimate.netTotal,
        Math.max(0, policy.value),
      );
    } else if (policy.mode === "INSCRIPTION_FEE") {
      requiredAmount = Math.min(
        financeEstimate.netTotal,
        financeEstimate.registrationNet,
      );
    } else if (policy.mode === "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE") {
      const trancheCount = Math.max(
        1,
        selectedScolaritePlan?.nombre_tranches ?? 1,
      );
      requiredAmount = Math.min(
        financeEstimate.netTotal,
        financeEstimate.registrationNet +
          financeEstimate.schoolNet / trancheCount,
      );
    }

    requiredAmount = Math.max(0, requiredAmount);
    const missingAmount = Math.max(
      0,
      requiredAmount - financeEstimate.initialPaymentAmount,
    );
    const satisfied = missingAmount <= 0.0001;

    let description = "Aucun paiement minimum n'est requis avant validation.";
    if (policy.mode === "PERCENT") {
      description = `Minimum requis: ${Number(policy.value).toLocaleString("fr-FR")}% du total net.`;
    } else if (policy.mode === "AMOUNT") {
      description = `Minimum requis: montant fixe de ${formatMoney(policy.value, financeEstimate.devise)}.`;
    } else if (policy.mode === "INSCRIPTION_FEE") {
      description = "Minimum requis: droit d'inscription paye.";
    } else if (policy.mode === "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE") {
      description =
        "Minimum requis: droit d'inscription + premiere tranche de scolarite.";
    }

    return {
      requiredAmount,
      missingAmount,
      satisfied,
      description,
    };
  }, [enrollmentFinancePolicy, financeEstimate, selectedScolaritePlan]);

  const paymentSchedulePreview = useMemo(() => {
    const inscriptionDateRaw =
      scolariteInitialData?.date_inscription ??
      new Date().toISOString().slice(0, 10);
    const inscriptionDate = new Date(String(inscriptionDateRaw));
    const anchorDate = Number.isNaN(inscriptionDate.getTime())
      ? new Date()
      : inscriptionDate;
    const paymentDay = Math.max(
      1,
      Math.min(28, Number(echeancierStepValues?.jour_paiement_mensuel ?? 5)),
    );
    const entries: Array<{
      key: string;
      label: string;
      amount: number;
      dateLabel: string;
    }> = [];

    const pushEntries = (
      label: string,
      amount: number,
      plan: CataloguePaymentPlan | null,
    ) => {
      if (amount <= 0) return;
      const trancheCount = Math.max(1, plan?.nombre_tranches ?? 1);
      const offsets =
        Array.isArray(plan?.offsets_mois) &&
        plan?.offsets_mois.length === trancheCount
          ? plan.offsets_mois
          : Array.from({ length: trancheCount }, (_, index) => index);
      const baseAmount = amount / trancheCount;
      let remaining = amount;

      for (let index = 0; index < trancheCount; index += 1) {
        const installmentAmount =
          index === trancheCount - 1 ? remaining : baseAmount;
        remaining -= installmentAmount;
        const scheduledDate = addMonthsWithPaymentDay(
          anchorDate,
          offsets[index] ?? index,
          paymentDay,
        );
        entries.push({
          key: `${label}-${index + 1}`,
          label:
            trancheCount === 1
              ? label
              : `${label} - tranche ${index + 1}/${trancheCount}`,
          amount: Math.max(0, installmentAmount),
          dateLabel: scheduledDate.toLocaleDateString("fr-FR"),
        });
      }
    };

    pushEntries(
      "Droit d'inscription",
      financeEstimate.registrationNet,
      selectedInscriptionPlan,
    );
    pushEntries(
      "Frais de scolarite",
      financeEstimate.schoolNet,
      selectedScolaritePlan,
    );

    return entries;
  }, [
    echeancierStepValues?.jour_paiement_mensuel,
    financeEstimate.registrationNet,
    financeEstimate.schoolNet,
    scolariteInitialData?.date_inscription,
    selectedInscriptionPlan,
    selectedScolaritePlan,
  ]);

  const financeSupplementary = useMemo(() => {
    const helperTone =
      financeEstimate.remainingAmount > 0
        ? "text-amber-700"
        : "text-emerald-700";
    const helperBg =
      financeEstimate.remainingAmount > 0
        ? "bg-amber-50 border-amber-200"
        : "bg-emerald-50 border-emerald-200";

    return (
      <div className="space-y-4">
        <div className={`rounded-3xl border px-4 py-4 ${helperBg}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Projection financiere
              </p>
              <p className="mt-1 text-sm text-slate-600">
                La synthese s'ajuste selon les frais choisis, la remise
                appliquee et le versement initial saisi.
              </p>
            </div>
            <div className={`text-sm font-semibold ${helperTone}`}>
              {financeEstimate.remainingAmount > 0
                ? "Un solde restera a planifier apres l'inscription."
                : "Le dossier est financierement solde a l'inscription."}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Brut
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatMoney(
                  financeEstimate.grossTotal,
                  financeEstimate.devise,
                )}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Remise
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatMoney(
                  financeEstimate.discountAmount,
                  financeEstimate.devise,
                )}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Net
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatMoney(financeEstimate.netTotal, financeEstimate.devise)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Versement
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatMoney(
                  financeEstimate.initialPaymentAmount,
                  financeEstimate.devise,
                )}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                Reste
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatMoney(
                  financeEstimate.remainingAmount,
                  financeEstimate.devise,
                )}
              </p>
            </div>
          </div>
        </div>

        {!financeEstimate.hasAnyFee ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Aucun frais n'est encore selectionne. Le total estime apparaitra des
            que tu choisis un droit d'inscription ou un frais de scolarite.
          </div>
        ) : null}

        {financeEstimate.hasAnyFee ? (
          <div
            className={`rounded-3xl border px-4 py-4 ${
              minimumPaymentPreview.satisfied
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Politique de validation
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {minimumPaymentPreview.description}
                </p>
              </div>
              <div
                className={`text-sm font-semibold ${
                  minimumPaymentPreview.satisfied
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {minimumPaymentPreview.satisfied
                  ? "Le minimum requis est atteint."
                  : "Le minimum requis n'est pas encore atteint."}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Minimum requis
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatMoney(
                    minimumPaymentPreview.requiredAmount,
                    financeEstimate.devise,
                  )}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Versement saisi
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatMoney(
                    financeEstimate.initialPaymentAmount,
                    financeEstimate.devise,
                  )}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Ecart
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatMoney(
                    minimumPaymentPreview.missingAmount,
                    financeEstimate.devise,
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {paymentSchedulePreview.length > 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Apercu de l'echeancier
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Projection des tranches generees a partir des plans choisis.
                  Les dates seront confirmees a l'etape plan de paiement.
                </p>
              </div>
              <div className="text-sm font-medium text-slate-500">
                {paymentSchedulePreview.length} ligne
                {paymentSchedulePreview.length > 1 ? "s" : ""} prevue
                {paymentSchedulePreview.length > 1 ? "s" : ""}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {paymentSchedulePreview.map((entry) => (
                <div
                  key={entry.key}
                  className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {entry.label}
                    </p>
                    <p className="text-xs text-slate-500">
                      Date indicative: {entry.dateLabel}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatMoney(entry.amount, financeEstimate.devise)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }, [financeEstimate, minimumPaymentPreview, paymentSchedulePreview]);

  const financeSchema = useMemo(
    () =>
      z
        .object({
          catalogue_frais_inscription_id: z.string().optional().nullable(),
          catalogue_frais_inscription_plan_code: z
            .string()
            .optional()
            .nullable(),
          catalogue_frais_scolarite_id: z.string().optional().nullable(),
          catalogue_frais_scolarite_plan_code: z.string().optional().nullable(),
          remise_id: z.string().optional().nullable(),
          remise_type: z.string().default("AUCUNE"),
          remise_valeur: z.coerce.number().min(0).default(0),
          montant_paye_initial: z.coerce.number().min(0).default(0),
          mode_paiement_initial: z.string().optional().nullable(),
          reference_paiement_initial: z.string().optional().nullable(),
          date_paiement_initial: z.coerce.date().optional().nullable(),
        })
        .superRefine((data, ctx) => {
          if (
            data.catalogue_frais_inscription_id &&
            selectedInscriptionPaymentPlans.length > 0
          ) {
            const selectedCode = normalizeOptionalString(
              data.catalogue_frais_inscription_plan_code,
            );
            if (!selectedCode) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["catalogue_frais_inscription_plan_code"],
                message:
                  "Choisis le plan autorise pour le droit d'inscription.",
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
                message:
                  "Le plan choisi n'est pas autorise pour ce droit d'inscription.",
              });
            }
          }
          if (
            data.catalogue_frais_scolarite_id &&
            selectedScolaritePaymentPlans.length > 0
          ) {
            const selectedCode = normalizeOptionalString(
              data.catalogue_frais_scolarite_plan_code,
            );
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
                message:
                  "Le plan choisi n'est pas autorise pour ce frais de scolarite.",
              });
            }
          }
          if ((data.montant_paye_initial ?? 0) > 0) {
            if (!normalizeOptionalString(data.mode_paiement_initial)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["mode_paiement_initial"],
                message: "Choisis le mode de paiement du versement initial.",
              });
            }
            if (!data.date_paiement_initial) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["date_paiement_initial"],
                message: "Renseigne la date du paiement initial.",
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
          montant_paye_initial: "Montant paye a l'inscription",
          mode_paiement_initial: "Mode de paiement initial",
          reference_paiement_initial: "Reference du paiement",
          date_paiement_initial: "Date du paiement",
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
              options: [
                { value: "", label: "Aucune remise" },
                ...remiseOptions,
              ],
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir",
              description:
                "Si une remise finance existe deja, elle prime sur la saisie manuelle.",
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
              description:
                "Utilise seulement si aucune remise preconfiguree n'est selectionnee.",
            },
          },
          montant_paye_initial: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "0",
              description:
                "Versement encaisse immediatement pendant l'inscription. Laisse a 0 si aucun paiement n'est enregistre maintenant.",
            },
          },
          mode_paiement_initial: {
            relation: {
              options: paymentMethodOptions,
            },
            fieldProps: {
              className: "md:col-span-1",
              emptyLabel: "Choisir",
              description:
                "Obligatoire uniquement si un montant est effectivement encaisse pendant l'inscription.",
            },
          },
          reference_paiement_initial: {
            fieldProps: {
              className: "md:col-span-1",
              placeholder: "Numero de transaction, cheque ou note interne",
              description:
                "Optionnel. Si vide, une reference automatique sera generee pour le recu.",
            },
          },
          date_paiement_initial: {
            dateMode: "date",
            fieldProps: {
              className: "md:col-span-1",
              description: "Date reelle d'encaissement du paiement initial.",
            },
          },
        },
      }),
    [
      financeSchema,
      inscriptionPlanOptions,
      inscriptionFeeOptions,
      paymentMethodOptions,
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
          jour_paiement_mensuel: z.coerce
            .number()
            .int()
            .min(1)
            .max(28)
            .optional()
            .nullable(),
          notes: z.string().optional().nullable(),
        })
        .superRefine((data, ctx) => {
          if (
            requiresPaymentDay &&
            (data.jour_paiement_mensuel == null ||
              Number.isNaN(Number(data.jour_paiement_mensuel)))
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["jour_paiement_mensuel"],
              message:
                "Renseigne le jour du mois pour les plans en plusieurs tranches.",
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
              description:
                "Le mode de paiement sera deduit automatiquement du plan genere.",
            },
          },
        },
      }),
    [echeancierSchema],
  );

  const handleFinanceValuesChange = (data: Record<string, any>) => {
    const selectedInscriptionFeeValue = normalizeOptionalString(
      data?.catalogue_frais_inscription_id,
    );
    const selectedInscription =
      inscriptionFeeOptions.find(
        (item) => item.value === selectedInscriptionFeeValue,
      ) ?? null;
    const selectedInscriptionPlanCode = normalizeOptionalString(
      data?.catalogue_frais_inscription_plan_code,
    );
    const inscriptionPlans = parsePaymentPlans(
      selectedInscription as CatalogueFeeOption | null,
    );
    const selectedInscriptionPlan =
      inscriptionPlans.find(
        (plan) =>
          plan.code === (selectedInscriptionPlanCode ?? "").toUpperCase(),
      ) ?? null;

    const selectedScolariteFeeValue = normalizeOptionalString(
      data?.catalogue_frais_scolarite_id,
    );
    const selectedScolarite =
      scolariteFeeOptions.find(
        (item) => item.value === selectedScolariteFeeValue,
      ) ?? null;
    const selectedScolaritePlanCode = normalizeOptionalString(
      data?.catalogue_frais_scolarite_plan_code,
    );
    const scolaritePlans = parsePaymentPlans(
      selectedScolarite as CatalogueFeeOption | null,
    );
    const selectedScolaritePlan =
      scolaritePlans.find(
        (plan) => plan.code === (selectedScolaritePlanCode ?? "").toUpperCase(),
      ) ?? null;

    setSelectedInscriptionFeeId(selectedInscriptionFeeValue);
    setSelectedScolariteFeeId(selectedScolariteFeeValue);
    setFinanceStepValues(data);
    setRequiresPaymentDay(
      (selectedInscriptionPlan?.nombre_tranches ?? 1) > 1 ||
        (selectedScolaritePlan?.nombre_tranches ?? 1) > 1,
    );
  };

  const eleveInitialValues = useMemo(
    () =>
      mode === "edit"
        ? ((editPayload?.eleve as Record<string, unknown> | undefined) ??
          undefined)
        : ((draft?.student_data as Record<string, unknown> | undefined) ??
          undefined),
    [draft?.student_data, editPayload?.eleve, mode],
  );

  const scolariteStepInitialValues = useMemo(
    () =>
      mode === "edit"
        ? ({
            ...(editPayload?.scolarite ?? {}),
            niveau_scolaire_id:
              (editPayload?.scolarite?.niveau_scolaire_id as
                | string
                | undefined) ?? "",
            classe_id: editPayload?.current_classe?.id ?? "",
          } as Record<string, unknown>)
        : ({
            ...(scolariteInitialData ?? {}),
            ...(draft?.schooling_data ?? {}),
            statut_inscription:
              draft?.schooling_data?.statut_inscription ??
              (enrollmentFormMode === "RAPIDE"
                ? "PREINSCRIT"
                : (scolariteInitialData?.statut_inscription ?? "INSCRIT")),
          } as Record<string, unknown>),
    [
      draft?.schooling_data,
      editPayload?.current_classe?.id,
      editPayload?.scolarite,
      enrollmentFormMode,
      mode,
      scolariteInitialData,
    ],
  );

  const tuteur1InitialValues = useMemo(
    () => {
      const draftGuardians = getDraftGuardians(draft);
      const defaults = {
        est_principal: true,
        est_responsable_legal: true,
        est_responsable_financier: true,
        est_contact_urgence: true,
        autorise_recuperation: true,
      };

      return mode === "edit"
        ? ((editPayload?.tuteur1 as Record<string, unknown> | undefined) ??
            defaults)
        : normalizeDraftGuardian(draftGuardians[0], defaults);
    },
    [draft, editPayload?.tuteur1, mode],
  );

  const tuteur2InitialValues = useMemo(
    () => {
      const draftGuardians = getDraftGuardians(draft);
      const defaults = {
        est_principal: false,
        est_responsable_legal: false,
        est_responsable_financier: false,
        est_contact_urgence: false,
        autorise_recuperation: true,
      };

      return mode === "edit"
        ? ((editPayload?.tuteur2 as Record<string, unknown> | undefined) ??
            defaults)
        : normalizeDraftGuardian(draftGuardians[1], defaults);
    },
    [draft, editPayload?.tuteur2, mode],
  );

  const documentsInitialValues = useMemo(
    () =>
      Object.fromEntries(
        documentFieldEntries.map((item) => [item.fieldName, false]),
      ) as Record<string, boolean>,
    [documentFieldEntries],
  );

  const draftDocumentInitialValues = useMemo(() => {
    const values = { ...documentsInitialValues };
    const draftDocuments = draft?.documents_data;
    const fields = asRecord(draftDocuments?.fields);

    if (fields) {
      for (const item of documentFieldEntries) {
        values[item.fieldName] = Boolean(fields[item.fieldName]);
      }
      return values;
    }

    const items = Array.isArray(draftDocuments?.items)
      ? (draftDocuments.items as Array<Record<string, unknown>>)
      : [];

    for (const item of documentFieldEntries) {
      const found = items.find(
        (document) => document.document_type_id === item.id,
      );
      values[item.fieldName] = Boolean(found?.fourni);
    }

    return values;
  }, [documentFieldEntries, documentsInitialValues, draft?.documents_data]);

  const medicalInitialValues = useMemo(
    () =>
      mode === "edit"
        ? ((editPayload?.medical as Record<string, unknown> | undefined) ?? {
            groupe_sanguin: "",
            allergies: "",
            maladies_particulieres: "",
            traitement_medical: "",
            medecin_traitant: "",
            telephone_medecin: "",
            autorisation_prise_en_charge_medicale: false,
            personne_a_contacter_urgence: "",
            telephone_urgence: "",
          })
        : ((draft?.medical_data as Record<string, unknown> | undefined) ?? {
            groupe_sanguin: "",
            allergies: "",
            maladies_particulieres: "",
            traitement_medical: "",
            medecin_traitant: "",
            telephone_medecin: "",
            autorisation_prise_en_charge_medicale: false,
            personne_a_contacter_urgence: "",
            telephone_urgence: "",
          }),
    [draft?.medical_data, editPayload?.medical, mode],
  );

  const historiqueScolaireInitialValues = useMemo(
    () =>
      mode === "edit"
        ? ((editPayload?.historique_scolaire as
            | Record<string, unknown>
            | undefined) ?? {
            ancien_etablissement: "",
            ancienne_classe: "",
            annee_precedente: "",
            derniere_moyenne: null,
            decision_precedente: "",
            mention_precedente: "",
            motif_transfert: "",
            observations: "",
            reprise_auto: false,
          })
        : ((draft?.previous_school_data as Record<string, unknown> | undefined) ?? {
            ancien_etablissement: "",
            ancienne_classe: "",
            annee_precedente: "",
            derniere_moyenne: null,
            decision_precedente: "",
            mention_precedente: "",
            motif_transfert: "",
            observations: "",
            reprise_auto: false,
          }),
    [draft?.previous_school_data, editPayload?.historique_scolaire, mode],
  );

  const accesSystemeInitialValues = useMemo(
    () =>
      mode === "edit"
        ? ((editPayload?.acces_systeme as
            | Record<string, unknown>
            | undefined) ?? {
            creer_compte_parent: false,
            creer_compte_eleve: false,
            email_connexion_parent: "",
            identifiant_connexion_eleve: "",
            methode_envoi_identifiants: "EMAIL",
            envoyer_identifiants_apres_validation: true,
          })
        : ((draft?.access_data as Record<string, unknown> | undefined) ?? {
            creer_compte_parent: false,
            creer_compte_eleve: false,
            email_connexion_parent: "",
            identifiant_connexion_eleve: "",
            methode_envoi_identifiants: "EMAIL",
            envoyer_identifiants_apres_validation: true,
          }),
    [draft?.access_data, editPayload?.acces_systeme, mode],
  );

  const consentementsInitialValues = useMemo(
    () =>
      mode === "edit"
        ? ((editPayload?.consentements as
            | Record<string, unknown>
            | undefined) ?? {
            autorisation_sortie: false,
            autorisation_photo_video: false,
            autorisation_activite_scolaire: false,
            autorisation_prise_en_charge_medicale: false,
            acceptation_reglement_interieur: false,
            acceptation_conditions_financieres: false,
            date_acceptation: null,
            signataire_nom: "",
            commentaire: "",
          })
        : ((draft?.consents_data as Record<string, unknown> | undefined) ?? {
            autorisation_sortie: false,
            autorisation_photo_video: false,
            autorisation_activite_scolaire: false,
            autorisation_prise_en_charge_medicale: false,
            acceptation_reglement_interieur: false,
            acceptation_conditions_financieres: false,
            date_acceptation: null,
            signataire_nom: "",
            commentaire: "",
          }),
    [draft?.consents_data, editPayload?.consentements, mode],
  );

  const observationsInitialValues = useMemo(
    () =>
      mode === "edit"
        ? ((editPayload?.observations as
            | Record<string, unknown>
            | undefined) ?? {
            observation_administrative: "",
            observation_pedagogique: "",
            observation_financiere: "",
            note_interne: "",
          })
        : ((draft?.observations_data as Record<string, unknown> | undefined) ?? {
            observation_administrative: "",
            observation_pedagogique: "",
            observation_financiere: "",
            note_interne: "",
          }),
    [draft?.observations_data, editPayload?.observations, mode],
  );

  const finalValidationSchema = useMemo(() => z.object({}), []);

  const buildFinalValidationSnapshot = useMemo(
    () => (allData: WizardData) => {
      // const eleve = (allData.eleve ?? {}) as Record<string, any>;
      const scolarite = (allData.scolarite ?? {}) as Record<string, any>;
      const consentements = (allData.consentements ?? {}) as Record<
        string,
        any
      >;
      const documentsData = (allData.documents ?? {}) as Record<string, any>;
      const tuteurs = [allData.tuteur1, allData.tuteur2].filter(
        hasTutorDraftData,
      );
      const reviewDocumentsEnabled =
        mode !== "edit" && documentFieldEntries.length > 0;

      const niveauLabel =
        niveauOptions.find(
          (item) =>
            item.value ===
            normalizeOptionalString(scolarite.niveau_scolaire_id),
        )?.label ?? "Non renseigne";
      const classeLabel =
        classeOptions.find(
          (item) => item.value === normalizeOptionalString(scolarite.classe_id),
        )?.label ?? "Non affectee";
      const typeInscriptionLabel =
        inscriptionTypeOptions.find(
          (item) =>
            item.value === normalizeOptionalString(scolarite.type_inscription),
        )?.label ?? "Non renseigne";
      const statutLabel =
        inscriptionStatusOptions.find(
          (item) =>
            item.value ===
            normalizeOptionalString(scolarite.statut_inscription),
        )?.label ?? "Non renseigne";

      const requiredDocuments = reviewDocumentsEnabled
        ? documentFieldEntries.filter((item) => item.obligatoire)
        : [];
      const missingRequiredDocuments = requiredDocuments.filter(
        (item) => !documentsData[item.fieldName] && !documentUploads[item.id],
      );

      const hasAnyFee = financeEstimate.hasAnyFee;
      const hasResponsiblePhone = tuteurs.some((tuteur) =>
        Boolean(
          normalizeOptionalString(tuteur.telephone) ||
            parentTuteurOptions.find(
              (item) =>
                item.value === normalizeOptionalString(tuteur.parent_tuteur_id),
            )?.telephone,
        ),
      );
      const hasFinancialResponsible = tuteurs.some((tuteur) =>
        Boolean(tuteur.est_responsable_financier ?? tuteur.est_principal),
      );
      const blockers: string[] = [];
      const warnings: string[] = [];

      if (tuteurs.length === 0) {
        blockers.push("Ajoute au moins un responsable avant la soumission.");
      }

      if (tuteurs.length > 0 && !hasResponsiblePhone) {
        blockers.push(
          "Renseigne un telephone principal pour au moins un responsable.",
        );
      }

      if (hasAnyFee && !hasFinancialResponsible) {
        blockers.push(
          "Definis un responsable financier pour les frais saisis.",
        );
      }

      if (
        financeEstimate.initialPaymentAmount >
        financeEstimate.netTotal + 0.0001
      ) {
        blockers.push(
          "Le montant paye a l'inscription depasse le total net facture.",
        );
      }

      if (hasAnyFee && !consentements.acceptation_conditions_financieres) {
        blockers.push(
          "Les conditions financieres doivent etre acceptees avant la soumission.",
        );
      }

      if (!normalizeOptionalString(scolarite.classe_id)) {
        warnings.push(
          "Aucune classe n'est encore affectee. Le dossier sera cree au niveau demande uniquement.",
        );
      }

      if (missingRequiredDocuments.length > 0) {
        warnings.push(
          `${missingRequiredDocuments.length} document(s) obligatoire(s) restent manquants pour un dossier complet.`,
        );
      }

      if (!consentements.acceptation_reglement_interieur) {
        warnings.push("Le reglement interieur n'est pas encore accepte.");
      }

      if (hasAnyFee && !minimumPaymentPreview.satisfied) {
        warnings.push(
          "Le versement initial n'atteint pas encore le minimum requis pour une validation immediate.",
        );
      }

      if (mode === "create") {
        warnings.push(
          "Une verification de doublon sera reexecutee a la soumission finale.",
        );
      }

      return {
        blockers,
        warnings,
        hasAnyFee,
        reviewDocumentsEnabled,
        niveauLabel,
        classeLabel,
        typeInscriptionLabel,
        statutLabel,
        tuteurs,
        missingRequiredDocuments,
      };
    },
    [
      classeOptions,
      documentFieldEntries,
      documentUploads,
      financeEstimate.hasAnyFee,
      financeEstimate.initialPaymentAmount,
      financeEstimate.netTotal,
      inscriptionStatusOptions,
      minimumPaymentPreview.satisfied,
      mode,
      niveauOptions,
      parentTuteurOptions,
    ],
  );

  const finalValidationSupplementary = useMemo(
    () =>
      ({ allData }: { allData: WizardData }) => {
        const snapshot = buildFinalValidationSnapshot(allData);
        const eleve = (allData.eleve ?? {}) as Record<string, any>;
        // const scolarite = (allData.scolarite ?? {}) as Record<string, any>;
        const consentements = (allData.consentements ?? {}) as Record<
          string,
          any
        >;
        const access = (allData.acces_systeme ?? {}) as Record<string, any>;

        return (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Synthese avant soumission
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Verifie les points bloquants, les avertissements et les
                  donnees-cle avant de finaliser l'inscription.
                </p>
              </div>
              <div
                className={`rounded-3xl border px-4 py-4 ${
                  snapshot.blockers.length > 0
                    ? "border-rose-200 bg-rose-50"
                    : snapshot.warnings.length > 0
                      ? "border-amber-200 bg-amber-50"
                      : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Etat de la soumission
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {snapshot.blockers.length > 0
                    ? `${snapshot.blockers.length} blocage(s) a corriger`
                    : snapshot.warnings.length > 0
                      ? `${snapshot.warnings.length} point(s) d'attention`
                      : "Dossier pret pour la soumission"}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {snapshot.blockers.length > 0
                    ? "La creation restera refusee tant que les points bloquants ne sont pas corriges."
                    : "Les avertissements peuvent laisser un dossier incomplet, mais n'empechent pas la creation si le reste est coherent."}
                </p>
              </div>
            </div>

            {snapshot.blockers.length > 0 ? (
              <ValidationAlertCard
                title="Blocages a corriger"
                tone="danger"
                items={snapshot.blockers}
              />
            ) : null}

            {snapshot.warnings.length > 0 ? (
              <ValidationAlertCard
                title="Points d'attention"
                tone="warning"
                items={snapshot.warnings}
              />
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              <ValidationReviewCard title="Identite de l'eleve">
                <ValidationReviewLine
                  label="Eleve"
                  value={
                    `${normalizeOptionalString(eleve.prenom) ?? "-"} ${normalizeOptionalString(eleve.nom) ?? ""}`.trim() ||
                    "Non renseigne"
                  }
                />
                <ValidationReviewLine
                  label="Date de naissance"
                  value={
                    eleve.date_naissance
                      ? new Date(eleve.date_naissance).toLocaleDateString(
                          "fr-FR",
                        )
                      : "Non renseignee"
                  }
                />
                <ValidationReviewLine
                  label="Sexe"
                  value={
                    normalizeOptionalString(eleve.genre) ?? "Non renseigne"
                  }
                />
                <ValidationReviewLine
                  label="Lieu de naissance"
                  value={
                    normalizeOptionalString(eleve.lieu_naissance) ??
                    "Non renseigne"
                  }
                />
                <ValidationReviewLine
                  label="Nationalite"
                  value={
                    normalizeOptionalString(eleve.nationalite) ??
                    "Non renseignee"
                  }
                />
                <ValidationReviewLine
                  label="Adresse"
                  value={
                    normalizeOptionalString(eleve.adresse) ?? "Non renseignee"
                  }
                />
                <ValidationReviewLine
                  label="Telephone eleve"
                  value={
                    normalizeOptionalString(eleve.telephone_eleve) ??
                    "Non renseigne"
                  }
                />
                <ValidationReviewLine
                  label="Email eleve"
                  value={
                    normalizeOptionalString(eleve.email_eleve) ??
                    "Non renseigne"
                  }
                />
              </ValidationReviewCard>

              <ValidationReviewCard title="Scolarite demandee">
                <ValidationReviewLine
                  label="Annee courante"
                  value={anneeScolaireLabel ?? "Non chargee"}
                />
                <ValidationReviewLine
                  label="Type"
                  value={snapshot.typeInscriptionLabel}
                />
                <ValidationReviewLine
                  label="Niveau"
                  value={snapshot.niveauLabel}
                />
                <ValidationReviewLine
                  label="Classe"
                  value={snapshot.classeLabel}
                />
                <ValidationReviewLine
                  label="Statut initial"
                  value={snapshot.statutLabel}
                />
              </ValidationReviewCard>

              <ValidationReviewCard title="Responsables">
                {snapshot.tuteurs.length > 0 ? (
                  <div className="space-y-3">
                    {snapshot.tuteurs.map((tuteur, index) => {
                      const selectedParent =
                        parentTuteurOptions.find(
                          (item) =>
                            item.value ===
                            normalizeOptionalString(tuteur.parent_tuteur_id),
                        ) ?? null;

                      return (
                        <div
                          key={`${index}-${getTutorDraftName(tuteur)}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {selectedParent?.label ?? getTutorDraftName(tuteur)}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {normalizeOptionalString(tuteur.relation) ??
                              "Lien non renseigne"}{" "}
                            -{" "}
                            {normalizeOptionalString(tuteur.telephone) ??
                              selectedParent?.telephone ??
                              "Sans telephone"}
                          </p>
                          {normalizeOptionalString(tuteur.profession) ||
                          selectedParent?.profession ||
                          normalizeOptionalString(tuteur.lieu_travail) ||
                          selectedParent?.lieu_travail ? (
                            <p className="mt-1 text-sm text-slate-500">
                              {[
                                normalizeOptionalString(tuteur.profession) ??
                                  selectedParent?.profession,
                                normalizeOptionalString(tuteur.lieu_travail) ??
                                  selectedParent?.lieu_travail,
                              ]
                                .filter(Boolean)
                                .join(" - ")}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <ValidationPill
                              tone={
                                (tuteur.est_responsable_legal ??
                                tuteur.est_principal)
                                  ? "success"
                                  : "neutral"
                              }
                              label={`Legal: ${parseBooleanLabel(Boolean(tuteur.est_responsable_legal ?? tuteur.est_principal))}`}
                            />
                            <ValidationPill
                              tone={
                                (tuteur.est_responsable_financier ??
                                tuteur.est_principal)
                                  ? "success"
                                  : "neutral"
                              }
                              label={`Financier: ${parseBooleanLabel(Boolean(tuteur.est_responsable_financier ?? tuteur.est_principal))}`}
                            />
                            <ValidationPill
                              tone={
                                (tuteur.est_contact_urgence ??
                                tuteur.est_principal)
                                  ? "success"
                                  : "neutral"
                              }
                              label={`Urgence: ${parseBooleanLabel(Boolean(tuteur.est_contact_urgence ?? tuteur.est_principal))}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Aucun responsable n'est encore saisi.
                  </p>
                )}
              </ValidationReviewCard>

              <ValidationReviewCard title="Finance et consentements">
                <ValidationReviewLine
                  label="Total net"
                  value={formatMoney(
                    financeEstimate.netTotal,
                    financeEstimate.devise,
                  )}
                />
                <ValidationReviewLine
                  label="Versement initial"
                  value={formatMoney(
                    financeEstimate.initialPaymentAmount,
                    financeEstimate.devise,
                  )}
                />
                <ValidationReviewLine
                  label="Reste a payer"
                  value={formatMoney(
                    financeEstimate.remainingAmount,
                    financeEstimate.devise,
                  )}
                />
                <ValidationReviewLine
                  label="Minimum requis"
                  value={formatMoney(
                    minimumPaymentPreview.requiredAmount,
                    financeEstimate.devise,
                  )}
                />
                <ValidationReviewLine
                  label="Conditions financieres"
                  value={parseBooleanLabel(
                    Boolean(consentements.acceptation_conditions_financieres),
                  )}
                />
                <ValidationReviewLine
                  label="Reglement interieur"
                  value={parseBooleanLabel(
                    Boolean(consentements.acceptation_reglement_interieur),
                  )}
                />
              </ValidationReviewCard>

              <ValidationReviewCard title="Documents administratifs">
                {snapshot.reviewDocumentsEnabled ? (
                  <>
                    <ValidationReviewLine
                      label="Documents requis"
                      value={`${documentFieldEntries.filter((item) => item.obligatoire).length}`}
                    />
                    <ValidationReviewLine
                      label="Documents manquants"
                      value={`${snapshot.missingRequiredDocuments.length}`}
                    />
                    {snapshot.missingRequiredDocuments.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {snapshot.missingRequiredDocuments.map((item) => (
                          <ValidationPill
                            key={item.id}
                            tone="warning"
                            label={item.nom}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-emerald-700">
                        Tous les documents obligatoires declares sont couverts.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Les documents restent geres depuis le resume d'inscription
                    pendant l'edition du dossier.
                  </p>
                )}
              </ValidationReviewCard>

              <ValidationReviewCard title="Acces au systeme">
                <ValidationReviewLine
                  label="Compte parent"
                  value={parseBooleanLabel(Boolean(access.creer_compte_parent))}
                />
                <ValidationReviewLine
                  label="Compte eleve"
                  value={parseBooleanLabel(Boolean(access.creer_compte_eleve))}
                />
                <ValidationReviewLine
                  label="Canal d'envoi"
                  value={
                    normalizeOptionalString(
                      access.methode_envoi_identifiants,
                    ) ?? "EMAIL"
                  }
                />
                <ValidationReviewLine
                  label="Apres validation"
                  value={parseBooleanLabel(
                    access.envoyer_identifiants_apres_validation !== false,
                  )}
                />
              </ValidationReviewCard>
            </div>
          </div>
        );
      },
    [
      anneeScolaireLabel,
      buildFinalValidationSnapshot,
      classeOptions,
      documentFieldEntries,
      financeEstimate.devise,
      financeEstimate.initialPaymentAmount,
      financeEstimate.netTotal,
      financeEstimate.remainingAmount,
      minimumPaymentPreview.requiredAmount,
      parentTuteurOptions,
    ],
  );

  const steps: WizardStep[] = useMemo(() => {
    const baseSteps: WizardStep[] = [
      {
        key: "eleve",
        title: "Fiche eleve",
        desc: "Identite, adresse et contact d'urgence du dossier.",
        schema: eleveSchema,
        fields: eleveFields,
        initialValues: eleveInitialValues,
        labelMessage: "Eleve",
        icon: <FiUser />,
      },
      {
        key: "scolarite",
        title: "Affectation scolaire",
        desc:
          mode === "edit"
            ? "Code eleve, type d'inscription et dates de reference. Le changement de classe reste une action dediee."
            : "Classe, code eleve et dates de reference de l'inscription.",
        schema: scolariteSchema,
        fields: scolariteFields,
        initialValues: scolariteStepInitialValues,
        labelMessage: "Scolarite",
        icon: <FiBookOpen />,
        onValuesChange: (data) => {
          const nextNiveauId = normalizeOptionalString(
            data?.niveau_scolaire_id,
          );
          const nextClasseId = normalizeOptionalString(data?.classe_id);
          const nextClasse =
            classeOptions.find((item) => item.value === nextClasseId) ?? null;
          const nextTypeInscription =
            normalizeOptionalString(data?.type_inscription) ??
            "NOUVELLE_INSCRIPTION";

          setSelectedNiveauId(
            nextNiveauId ?? nextClasse?.niveau_scolaire_id ?? null,
          );
          setSelectedInscriptionType(nextTypeInscription);
        },
      },
      {
        key: "tuteur1",
        title: "Parent ou tuteur principal",
        desc: "Responsable legal principal a rattacher immediatement.",
        schema: tuteur1Schema,
        fields: tuteur1Fields,
        initialValues: tuteur1InitialValues,
        labelMessage: "Tuteur principal",
        icon: <FiShield />,
        syncValues: tuteur1SyncValues,
        onValuesChange: (data) => {
          const selectedParentId = normalizeOptionalString(
            data?.parent_tuteur_id,
          );
          if (selectedParentId !== lastSelectedTutor1ParentId) {
            setLastSelectedTutor1ParentId(selectedParentId);
            setTuteur1SyncValues(
              selectedParentId
                ? buildTutorSyncValues(data, parentTuteurOptions, {
                    est_principal: true,
                    est_responsable_legal: true,
                    est_responsable_financier: true,
                    est_contact_urgence: true,
                    autorise_recuperation: true,
                  })
                : undefined,
            );
          }
        },
      },
      {
        key: "tuteur2",
        title: "Second parent ou tuteur",
        desc: "Contact secondaire optionnel pour le suivi familial.",
        schema: tuteur2Schema,
        fields: tuteur2Fields,
        initialValues: tuteur2InitialValues,
        labelMessage: "Tuteur secondaire",
        icon: <FiUsers />,
        syncValues: tuteur2SyncValues,
        onValuesChange: (data) => {
          const selectedParentId = normalizeOptionalString(
            data?.parent_tuteur_id,
          );
          if (selectedParentId !== lastSelectedTutor2ParentId) {
            setLastSelectedTutor2ParentId(selectedParentId);
            setTuteur2SyncValues(
              selectedParentId
                ? buildTutorSyncValues(data, parentTuteurOptions, {
                    est_principal: false,
                    est_responsable_legal: false,
                    est_responsable_financier: false,
                    est_contact_urgence: false,
                    autorise_recuperation: true,
                  })
                : undefined,
            );
          }
        },
      },
    ];

    const dossierExtendedSteps: WizardStep[] = [
      {
        key: "documents",
        title: "Documents administratifs",
        desc:
          documentFieldEntries.length > 0
            ? "Coche les pieces deja remises au moment de l'inscription. Les fichiers pourront ensuite etre ajoutes ou verifies depuis le resume."
            : "Aucun document obligatoire n'est encore configure pour ce type d'inscription. La verification restera possible depuis le resume.",
        schema: documentsSchema,
        fields: documentsFields,
        initialValues: draftDocumentInitialValues,
        labelMessage: "Documents",
        icon: <FiFileText />,
        onValuesChange: (data) => {
          setDocumentChecklistValues(data as Record<string, boolean>);
        },
        supplementary: documentsSupplementary,
      },
      {
        key: "medical",
        title: "Sante et securite",
        desc: "Renseigne les informations utiles a la prise en charge et aux alertes de securite.",
        schema: medicalSchema,
        fields: medicalFields,
        initialValues: medicalInitialValues,
        labelMessage: "Medical",
        icon: <FiHeart />,
      },
      {
        key: "historique_scolaire",
        title: "Historique scolaire",
        desc: "Conserve le contexte pedagogique precedent pour les transferts, reinscriptions et suivis.",
        schema: historiqueScolaireSchema,
        fields: historiqueScolaireFields,
        initialValues: historiqueScolaireInitialValues,
        labelMessage: "Historique",
        icon: <FiBookOpen />,
      },
      {
        key: "acces_systeme",
        title: "Acces au systeme",
        desc: "Prepare l'ouverture des comptes parent et eleve, ainsi que la methode de diffusion des identifiants.",
        schema: accesSystemeSchema,
        fields: accesSystemeFields,
        initialValues: accesSystemeInitialValues,
        labelMessage: "Acces",
        icon: <FiKey />,
      },
      {
        key: "consentements",
        title: "Autorisations et consentements",
        desc: "Historise les accords utiles avant validation du dossier eleve.",
        schema: consentementsSchema,
        fields: consentementsFields,
        initialValues: consentementsInitialValues,
        labelMessage: "Consentements",
        icon: <FiClipboard />,
      },
      {
        key: "observations",
        title: "Observations administratives",
        desc: "Conserve les notes internes, administratives, pedagogiques et financieres.",
        schema: observationsSchema,
        fields: observationsFields,
        initialValues: observationsInitialValues,
        labelMessage: "Observations",
        icon: <FiFileText />,
      },
    ];

    if (mode === "edit") {
      return [
        ...baseSteps,
        ...dossierExtendedSteps.filter((step) => step.key !== "documents"),
        {
          key: "validation_finale",
          title: "Validation finale",
          desc: "Controle la synthese du dossier avant de reappliquer les modifications.",
          schema: finalValidationSchema,
          fields: [],
          initialValues: {},
          labelMessage: "Validation finale",
          icon: <FiClipboard />,
          supplementary: finalValidationSupplementary,
        },
      ];
    }

    if (enrollmentFormMode === "RAPIDE") {
      return [
        ...baseSteps.slice(0, 3),
        {
          key: "finance",
          title: "Tarif et paiement initial",
          desc: "Selection rapide des frais principaux. Le reste du dossier pourra etre complete ensuite depuis le resume.",
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
            montant_paye_initial: 0,
            mode_paiement_initial: "",
            reference_paiement_initial: "",
            date_paiement_initial: null,
            ...(draft?.finance_data ?? {}),
          },
          labelMessage: "Finance",
          icon: <FiCreditCard />,
          supplementary: financeSupplementary,
        },
        {
          key: "validation_finale",
          title: "Validation finale",
          desc: "Verifie les informations minimales, les frais et les pieces manquantes avant d'ouvrir le dossier.",
          schema: finalValidationSchema,
          fields: [],
          initialValues: {},
          labelMessage: "Validation finale",
          icon: <FiClipboard />,
          supplementary: finalValidationSupplementary,
        },
      ];
    }

    return [
      ...baseSteps,
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
          ...(draft?.services_data ?? {}),
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
          montant_paye_initial: 0,
          mode_paiement_initial: "",
          reference_paiement_initial: "",
          date_paiement_initial: null,
          ...(draft?.finance_data ?? {}),
        },
        labelMessage: "Finance",
        icon: <FiCreditCard />,
        supplementary: financeSupplementary,
      },
      ...dossierExtendedSteps,
      {
        key: "echeancier",
        title: "Plan de paiement",
        desc: "Jour de paiement du mois et generation automatique des echeances a partir du plan annuel choisi.",
        schema: echeancierSchema,
        fields: echeancierFields,
        onValuesChange: (data) => {
          setEcheancierStepValues(data);
        },
        initialValues: {
          jour_paiement_mensuel: 5,
          notes: "",
          ...(draft?.payment_schedule_data ?? {}),
        },
        labelMessage: "Echeancier",
        icon: <FiMapPin />,
      },
      {
        key: "validation_finale",
        title: "Validation finale",
        desc: "Passe en revue le dossier, les frais, les documents et les consentements avant de finaliser l'inscription.",
        schema: finalValidationSchema,
        fields: [],
        initialValues: {},
        labelMessage: "Validation finale",
        icon: <FiClipboard />,
        supplementary: finalValidationSupplementary,
      },
    ];
  }, [
    eleveInitialValues,
    draft?.finance_data,
    draft?.services_data,
    draft?.payment_schedule_data,
    echeancierFields,
    echeancierSchema,
    finalValidationSchema,
    finalValidationSupplementary,
    buildTutorSyncValues,
    eleveFields,
    eleveSchema,
    editPayload,
    accesSystemeFields,
    accesSystemeInitialValues,
    accesSystemeSchema,
    consentementsFields,
    consentementsInitialValues,
    consentementsSchema,
    financeFields,
    financeSchema,
    documentFieldEntries.length,
    documentsFields,
    draftDocumentInitialValues,
    documentsInitialValues,
    documentsSupplementary,
    documentsSchema,
    historiqueScolaireFields,
    historiqueScolaireInitialValues,
    historiqueScolaireSchema,
    medicalFields,
    medicalInitialValues,
    medicalSchema,
    mode,
    observationsFields,
    observationsInitialValues,
    observationsSchema,
    enrollmentFormMode,
    lastSelectedTutor1ParentId,
    lastSelectedTutor2ParentId,
    parentTuteurOptions,
    scolariteFields,
    scolariteStepInitialValues,
    scolariteSchema,
    servicesFields,
    servicesSchema,
    setEcheancierStepValues,
    tuteur1InitialValues,
    tuteur1Fields,
    tuteur1Schema,
    tuteur1SyncValues,
    tuteur2InitialValues,
    tuteur2Fields,
    tuteur2Schema,
    tuteur2SyncValues,
    handleFinanceValuesChange,
  ]);

  const financeStepIndex = useMemo(
    () => steps.findIndex((item) => item.key === "finance"),
    [steps],
  );

  const wizardInitialData = useMemo<WizardData>(
    () => ({
      eleve: eleveInitialValues ?? {},
      scolarite: scolariteStepInitialValues ?? {},
      tuteur1: tuteur1InitialValues ?? {},
      tuteur2: tuteur2InitialValues ?? {},
      documents: draftDocumentInitialValues ?? {},
      medical: medicalInitialValues ?? {},
      historique_scolaire: historiqueScolaireInitialValues ?? {},
      acces_systeme: accesSystemeInitialValues ?? {},
      consentements: consentementsInitialValues ?? {},
      observations: observationsInitialValues ?? {},
      services: {
        transport_active: false,
        transport_mode_facturation: "SERVICE_ONLY",
        cantine_active: false,
        cantine_mode_facturation: "SERVICE_ONLY",
        ...(draft?.services_data ?? {}),
      },
      finance: {
        catalogue_frais_inscription_id: "",
        catalogue_frais_inscription_plan_code: "",
        catalogue_frais_scolarite_id: "",
        catalogue_frais_scolarite_plan_code: "",
        remise_id: "",
        remise_type: "AUCUNE",
        remise_valeur: 0,
        montant_paye_initial: 0,
        mode_paiement_initial: "",
        reference_paiement_initial: "",
        date_paiement_initial: null,
        ...(draft?.finance_data ?? {}),
      },
      echeancier: {
        jour_paiement_mensuel: 5,
        notes: "",
        ...(draft?.payment_schedule_data ?? {}),
      },
    }),
    [
      accesSystemeInitialValues,
      consentementsInitialValues,
      draft?.finance_data,
      draft?.payment_schedule_data,
      draft?.services_data,
      draftDocumentInitialValues,
      eleveInitialValues,
      historiqueScolaireInitialValues,
      medicalInitialValues,
      observationsInitialValues,
      scolariteStepInitialValues,
      tuteur1InitialValues,
      tuteur2InitialValues,
    ],
  );

  const wizardInitialStep = useMemo(() => {
    const stepFromDraft = Number(draft?.current_step ?? 1);
    return Number.isFinite(stepFromDraft) ? Math.max(0, stepFromDraft - 1) : 0;
  }, [draft?.current_step]);

  const buildDraftPayloadFromWizardData = (
    allData: WizardData,
    currentStep?: number,
  ): EnrollmentDraftPayload => ({
    etablissement_id,
    annee_scolaire_id: anneeScolaireId,
    draft_type:
      draft?.draft_type === "RE_ENROLLMENT" ? "RE_ENROLLMENT" : "NEW_ENROLLMENT",
    current_step: currentStep,
    student_data: allData.eleve ?? null,
    schooling_data: allData.scolarite ?? null,
    guardians_data: {
      items: [allData.tuteur1, allData.tuteur2].filter(hasTutorDraftData),
    },
    documents_data: allData.documents ? { fields: allData.documents } : null,
    medical_data: allData.medical ?? null,
    previous_school_data: allData.historique_scolaire ?? null,
    access_data: allData.acces_systeme ?? null,
    consents_data: allData.consentements ?? null,
    observations_data: allData.observations ?? null,
    finance_data: allData.finance ?? null,
    services_data: allData.services ?? null,
    payment_schedule_data: allData.echeancier ?? null,
  });

  const handleFinish = async (finalData: WizardData) => {
    try {
      setLoading(true);
      const finalSnapshot = buildFinalValidationSnapshot(finalData);

      if (finalSnapshot.blockers.length > 0) {
        throw new Error(
          `Finalisation impossible : ${finalSnapshot.blockers.join(" ")}`,
        );
      }

      if (!etablissement_id) {
        info("Etablissement introuvable, veuillez vous reconnecter.", "error");
        return;
      }

      if (!anneeScolaireId && mode === "create") {
        info("Annee scolaire non chargee. Rechargez la page.", "error");
        return;
      }

      const scolarite = finalData.scolarite ?? {};

      const eleve = finalData.eleve ?? {};
      const contactUrgenceNom = normalizeOptionalString(
        eleve.contact_urgence_nom,
      );
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
        zone_transport: normalizeOptionalString(
          finalData.services?.zone_transport,
        ),
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
        montant_paye_initial: Number(
          finalData.finance?.montant_paye_initial ?? 0,
        ),
        mode_paiement_initial: normalizeOptionalString(
          finalData.finance?.mode_paiement_initial,
        ),
        reference_paiement_initial: normalizeOptionalString(
          finalData.finance?.reference_paiement_initial,
        ),
        date_paiement_initial:
          finalData.finance?.date_paiement_initial instanceof Date
            ? finalData.finance.date_paiement_initial.toISOString().slice(0, 10)
            : normalizeOptionalString(finalData.finance?.date_paiement_initial),
      };

      const normalizedMedical = {
        groupe_sanguin: normalizeOptionalString(
          finalData.medical?.groupe_sanguin,
        ),
        allergies: normalizeOptionalString(finalData.medical?.allergies),
        maladies_particulieres: normalizeOptionalString(
          finalData.medical?.maladies_particulieres,
        ),
        traitement_medical: normalizeOptionalString(
          finalData.medical?.traitement_medical,
        ),
        medecin_traitant: normalizeOptionalString(
          finalData.medical?.medecin_traitant,
        ),
        telephone_medecin: normalizeOptionalString(
          finalData.medical?.telephone_medecin,
        ),
        autorisation_prise_en_charge_medicale: Boolean(
          finalData.medical?.autorisation_prise_en_charge_medicale,
        ),
        personne_a_contacter_urgence: normalizeOptionalString(
          finalData.medical?.personne_a_contacter_urgence,
        ),
        telephone_urgence: normalizeOptionalString(
          finalData.medical?.telephone_urgence,
        ),
      };

      const rawDerniereMoyenne =
        finalData.historique_scolaire?.derniere_moyenne;
      const parsedDerniereMoyenne =
        rawDerniereMoyenne === null ||
        rawDerniereMoyenne === undefined ||
        rawDerniereMoyenne === ""
          ? null
          : Number(rawDerniereMoyenne);
      const normalizedSchoolHistory = {
        ancien_etablissement: normalizeOptionalString(
          finalData.historique_scolaire?.ancien_etablissement,
        ),
        ancienne_classe: normalizeOptionalString(
          finalData.historique_scolaire?.ancienne_classe,
        ),
        annee_precedente: normalizeOptionalString(
          finalData.historique_scolaire?.annee_precedente,
        ),
        derniere_moyenne:
          parsedDerniereMoyenne != null &&
          Number.isFinite(parsedDerniereMoyenne)
            ? parsedDerniereMoyenne
            : null,
        decision_precedente: normalizeOptionalString(
          finalData.historique_scolaire?.decision_precedente,
        ),
        mention_precedente: normalizeOptionalString(
          finalData.historique_scolaire?.mention_precedente,
        ),
        motif_transfert: normalizeOptionalString(
          finalData.historique_scolaire?.motif_transfert,
        ),
        observations: normalizeOptionalString(
          finalData.historique_scolaire?.observations,
        ),
        reprise_auto: Boolean(finalData.historique_scolaire?.reprise_auto),
      };

      const normalizedDocuments = documentFieldEntries.map((item) => ({
        content_base64: documentUploads[item.id]?.contentBase64 ?? null,
        file_name: documentUploads[item.id]?.fileName ?? null,
        document_type_id: item.id,
        fourni:
          Boolean(finalData.documents?.[item.fieldName]) ||
          Boolean(documentUploads[item.id]),
        mime_type: documentUploads[item.id]?.mimeType ?? null,
      }));

      const normalizedAccessSystem = {
        creer_compte_parent: Boolean(
          finalData.acces_systeme?.creer_compte_parent,
        ),
        creer_compte_eleve: Boolean(
          finalData.acces_systeme?.creer_compte_eleve,
        ),
        email_connexion_parent: normalizeOptionalString(
          finalData.acces_systeme?.email_connexion_parent,
        ),
        identifiant_connexion_eleve: normalizeOptionalString(
          finalData.acces_systeme?.identifiant_connexion_eleve,
        ),
        methode_envoi_identifiants:
          normalizeOptionalString(
            finalData.acces_systeme?.methode_envoi_identifiants,
          ) ?? "EMAIL",
        envoyer_identifiants_apres_validation:
          finalData.acces_systeme?.envoyer_identifiants_apres_validation !==
          false,
      };

      const normalizedConsents = {
        autorisation_sortie: Boolean(
          finalData.consentements?.autorisation_sortie,
        ),
        autorisation_photo_video: Boolean(
          finalData.consentements?.autorisation_photo_video,
        ),
        autorisation_activite_scolaire: Boolean(
          finalData.consentements?.autorisation_activite_scolaire,
        ),
        autorisation_prise_en_charge_medicale: Boolean(
          finalData.consentements?.autorisation_prise_en_charge_medicale,
        ),
        acceptation_reglement_interieur: Boolean(
          finalData.consentements?.acceptation_reglement_interieur,
        ),
        acceptation_conditions_financieres: Boolean(
          finalData.consentements?.acceptation_conditions_financieres,
        ),
        date_acceptation:
          finalData.consentements?.date_acceptation instanceof Date
            ? finalData.consentements.date_acceptation
                .toISOString()
                .slice(0, 10)
            : normalizeOptionalString(
                finalData.consentements?.date_acceptation,
              ),
        signataire_nom: normalizeOptionalString(
          finalData.consentements?.signataire_nom,
        ),
        commentaire: normalizeOptionalString(
          finalData.consentements?.commentaire,
        ),
      };

      const normalizedObservations = {
        observation_administrative: normalizeOptionalString(
          finalData.observations?.observation_administrative,
        ),
        observation_pedagogique: normalizeOptionalString(
          finalData.observations?.observation_pedagogique,
        ),
        observation_financiere: normalizeOptionalString(
          finalData.observations?.observation_financiere,
        ),
        note_interne: normalizeOptionalString(
          finalData.observations?.note_interne,
        ),
      };

      const basePayload = {
        acces_systeme: normalizedAccessSystem,
        consentements: normalizedConsents,
        eleve: {
          prenom: eleve.prenom,
          nom: eleve.nom,
          date_naissance: eleve.date_naissance ?? null,
          lieu_naissance: normalizeOptionalString(eleve.lieu_naissance),
          nationalite: normalizeOptionalString(eleve.nationalite),
          genre: normalizeOptionalString(eleve.genre),
          photo_url: normalizeOptionalString(eleve.photo_url),
          adresse: normalizeOptionalString(eleve.adresse),
          telephone_eleve: normalizeOptionalString(eleve.telephone_eleve),
          email_eleve: normalizeOptionalString(eleve.email_eleve),
          contact_urgence_json: contactUrgence,
        },
        historique_scolaire: normalizedSchoolHistory,
        medical: normalizedMedical,
        observations: normalizedObservations,
        scolarite: {
          ...scolarite,
          statut_inscription: (scolarite.statut_inscription ??
            (mode === "create" && enrollmentFormMode === "RAPIDE"
              ? "PREINSCRIT"
              : "INSCRIT")) as StatutInscription,
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
            telephone_secondaire: normalizeOptionalString(
              t.telephone_secondaire,
            ),
            email: normalizeOptionalString(t.email),
            adresse: normalizeOptionalString(t.adresse),
            profession: normalizeOptionalString(t.profession),
            lieu_travail: normalizeOptionalString(t.lieu_travail),
            relation: normalizeOptionalString(t.relation),
            est_principal: Boolean(t.est_principal),
            est_responsable_legal: Boolean(
              t.est_responsable_legal ?? t.est_principal,
            ),
            est_responsable_financier: Boolean(
              t.est_responsable_financier ?? t.est_principal,
            ),
            est_contact_urgence: Boolean(
              t.est_contact_urgence ?? t.est_principal,
            ),
            autorise_recuperation: Boolean(t.autorise_recuperation),
          })),
      };

      if (mode === "edit") {
        if (!inscriptionId) {
          throw new Error("Inscription introuvable pour l'edition.");
        }

        const result = await inscriptionService.updateFull(
          inscriptionId,
          basePayload,
        );
        if (!result?.status?.success) {
          throw new Error("Mise a jour de l'inscription impossible");
        }

        info("Inscription mise a jour avec succes.", "success");
        navigate(`/scolarite/inscriptions/${inscriptionId}/resume`);
        return;
      }

      const payload = {
        ...basePayload,
        etablissement_id,
        mode_inscription: enrollmentFormMode,
        documents: normalizedDocuments,
        services: normalizedServices,
        finance: normalizedFinance,
        echeancier: {
          jour_paiement_mensuel:
            finalData.echeancier?.jour_paiement_mensuel == null
              ? null
              : Math.max(
                  1,
                  Math.min(
                    28,
                    Number(finalData.echeancier?.jour_paiement_mensuel ?? 5),
                  ),
                ),
          notes: normalizeOptionalString(finalData.echeancier?.notes),
        },
      };

      if (onDraftFinalize) {
        const inscriptionId = await onDraftFinalize({
          ...buildDraftPayloadFromWizardData(finalData, steps.length),
          student_data: basePayload.eleve,
          schooling_data: basePayload.scolarite,
          guardians_data: { items: basePayload.tuteurs },
          documents_data: { items: normalizedDocuments },
          medical_data: normalizedMedical,
          previous_school_data: normalizedSchoolHistory,
          access_data: normalizedAccessSystem,
          consents_data: normalizedConsents,
          observations_data: normalizedObservations,
          finance_data: normalizedFinance,
          services_data: normalizedServices,
          payment_schedule_data: payload.echeancier,
        });
        await getInscriptionOptions(etablissement_id);
        setDocumentUploads({});
        navigate(`/scolarite/inscriptions/${inscriptionId}/resume`);
        return;
      }

      const result = await onCreateInscriptionFull(payload);
      if (!result?.status?.success) {
        throw new Error("Creation de l'inscription impossible");
      }

      await getInscriptionOptions(etablissement_id);
      setDocumentUploads({});
      info(result, "success");
      const createdInscriptionId = result?.data?.inscription?.id;
      if (typeof createdInscriptionId === "string" && createdInscriptionId.trim()) {
        navigate(`/scolarite/inscriptions/${createdInscriptionId}/resume`);
      }
    } catch (error) {
      console.error("Erreur finalisation inscription :", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  if (loadingEditPayload) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-600 shadow-sm">
        Chargement du dossier d'inscription a modifier...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mode === "create" ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Annee scolaire courante
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {anneeScolaireLabel ?? "Annee non chargee"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Mode d'inscription
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { value: "RAPIDE", label: "Inscription rapide" },
                    { value: "COMPLETE", label: "Inscription complete" },
                  ] as Array<{ value: EnrollmentFormMode; label: string }>
                ).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setEnrollmentFormMode(item.value)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                      enrollmentFormMode === item.value
                        ? "border-sky-300 bg-sky-50 text-sky-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900">
          <p className="font-semibold">Edition de l'inscription</p>
          <p className="mt-1">
            Classe actuelle:{" "}
            {editPayload?.current_classe?.nom ?? "Non affectee"}
            {editPayload?.current_classe?.niveau
              ? ` - ${editPayload.current_classe.niveau}`
              : ""}
            {editPayload?.current_classe?.site
              ? ` - ${editPayload.current_classe.site}`
              : ""}
            .
          </p>
          <p className="mt-1">
            Pour changer la classe, utilise l'action dediee depuis le resume
            afin de conserver la regularisation financiere.
          </p>
        </div>
      ) : null}

      <MultiStepFormWizard
        key={`${mode}-${enrollmentFormMode}-${draft?.id ?? "standard"}`}
        title={
          mode === "edit" ? "Modifier une inscription" : "Inscrire un eleve"
        }
        subtitle={
          mode === "edit"
            ? "Mettez a jour les informations du dossier eleve et de l'inscription, sans casser les flux de validation, de classe et de finance."
            : enrollmentFormMode === "RAPIDE"
              ? "Saisissez l'essentiel pour ouvrir rapidement un dossier eleve, puis completez-le ensuite."
              : "Construisez un dossier complet et propre, depuis la fiche eleve jusqu'aux services et au plan financier."
        }
        steps={steps}
        initialData={wizardInitialData}
        initialStep={wizardInitialStep}
        onFinish={handleFinish}
        onStepChange={(stepIndex, allData) => {
          if (
            mode === "create" &&
            etablissement_id &&
            stepIndex === financeStepIndex
          ) {
            void getInscriptionOptions(etablissement_id);
          }

          const selectedClasseId = allData?.scolarite?.classe_id;
          const selectedClasse = classeOptions.find(
            (item) => item.value === selectedClasseId,
          );
          const selectedNiveauValue = normalizeOptionalString(
            allData?.scolarite?.niveau_scolaire_id,
          );
          const selectedTypeValue =
            normalizeOptionalString(allData?.scolarite?.type_inscription) ??
            "NOUVELLE_INSCRIPTION";
          const selectedInscriptionFeeValue = normalizeOptionalString(
            allData?.finance?.catalogue_frais_inscription_id,
          );
          const selectedInscription =
            inscriptionFeeOptions.find(
              (item) => item.value === selectedInscriptionFeeValue,
            ) ?? null;
          const selectedInscriptionPlanCode = normalizeOptionalString(
            allData?.finance?.catalogue_frais_inscription_plan_code,
          );
          const inscriptionPlans = parsePaymentPlans(
            selectedInscription as CatalogueFeeOption | null,
          );
          const selectedInscriptionPlan =
            inscriptionPlans.find(
              (plan) =>
                plan.code === (selectedInscriptionPlanCode ?? "").toUpperCase(),
            ) ?? null;
          const selectedScolariteFeeValue = normalizeOptionalString(
            allData?.finance?.catalogue_frais_scolarite_id,
          );
          const selectedScolarite =
            scolariteFeeOptions.find(
              (item) => item.value === selectedScolariteFeeValue,
            ) ?? null;
          const selectedScolaritePlanCode = normalizeOptionalString(
            allData?.finance?.catalogue_frais_scolarite_plan_code,
          );
          const scolaritePlans = parsePaymentPlans(
            selectedScolarite as CatalogueFeeOption | null,
          );
          const selectedScolaritePlan =
            scolaritePlans.find(
              (plan) =>
                plan.code === (selectedScolaritePlanCode ?? "").toUpperCase(),
            ) ?? null;
          setSelectedNiveauId(
            selectedNiveauValue ?? selectedClasse?.niveau_scolaire_id ?? null,
          );
          setSelectedInscriptionType(selectedTypeValue);
          setSelectedTransportActive(
            Boolean(allData?.services?.transport_active),
          );
          // setSelectedCantineActive(Boolean(allData?.services?.cantine_active));
          setSelectedTransportLineId(
            normalizeOptionalString(allData?.services?.ligne_transport_id),
          );
          setSelectedInscriptionFeeId(selectedInscriptionFeeValue);
          setSelectedScolariteFeeId(selectedScolariteFeeValue);
          setRequiresPaymentDay(
            (selectedInscriptionPlan?.nombre_tranches ?? 1) > 1 ||
              (selectedScolaritePlan?.nombre_tranches ?? 1) > 1,
          );

          if (onDraftAutosave) {
            void onDraftAutosave(
              buildDraftPayloadFromWizardData(allData, stepIndex + 1),
            );
          }
        }}
        submitHint={
          mode === "edit"
            ? "Les informations modifiees seront reappliquees au dossier eleve, a l'inscription et aux responsables lies."
            : "Chaque etape enregistre des informations utiles au dossier eleve. La derniere validation cree l'inscription, les rattachements et la base du suivi financier."
        }
      />
    </div>
  );
}

function ValidationAlertCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "danger" | "warning";
}) {
  const className =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div className={`rounded-3xl border px-4 py-4 ${className}`}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <p key={item}>- {item}</p>
        ))}
      </div>
    </div>
  );
}

function ValidationReviewCard({
  title,
  children,
}: {
  title: string;
  children: any;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function ValidationReviewLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function ValidationPill({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "neutral";
}) {
  const className =
    tone === "success"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warning"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}
