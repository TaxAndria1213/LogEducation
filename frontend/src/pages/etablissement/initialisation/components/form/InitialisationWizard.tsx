import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiLayers,
  FiMapPin,
  FiShield,
} from "react-icons/fi";
import { useInfo } from "../../../../../hooks/useInfo";
import InitialisationEtablissementService from "../../../../../services/initialisationEtablissement.service";
import type {
  InitialisationCommitResult,
  InitialisationSetupDraft,
  InitialisationTemplates,
} from "../../types";
import GenerationReport from "../shared/GenerationReport";
import StepAcademique from "../steps/StepAcademique";
import StepAnneeInitiale from "../steps/StepAnneeInitiale";
import StepAuditNotifications from "../steps/StepAuditNotifications";
import StepClasses from "../steps/StepClasses";
import StepEtablissementBase from "../steps/StepEtablissementBase";
import StepFinance from "../steps/StepFinance";
import StepNiveaux from "../steps/StepNiveaux";
import StepResumeGeneration from "../steps/StepResumeGeneration";
import StepSecurite from "../steps/StepSecurite";
import { useInitialisationWizardStore } from "../../store/InitialisationWizardStore";
import {
  areAcademicGroupsEqual,
  countEnteredAcademicSubjects,
  syncAcademicGroups,
} from "../../utils/academics";
import {
  areClassGroupsEqual,
  areStringArraysEqual,
  buildSelectedLevelCodes,
  countEnteredClasses,
  resolveDraftLevels,
  syncClassGroups,
} from "../../utils/levels";
import {
  countConfiguredPeriods,
  getSelectedPeriodTemplate,
} from "../../utils/periods";

type Props = {
  etablissementId: string;
  templates: InitialisationTemplates | null;
  onClose: () => void;
  onCompleted: (result: InitialisationCommitResult) => void | Promise<void>;
  onHeaderActionsChange?: (actions: ReactNode | null) => void;
  onScrollTopRequest?: () => void;
};

const DEFAULT_SECURITY_ROLE_NAMES = ["Direction", "Secretariat", "Enseignant"];

function buildDefaultDraft(etablissementId: string): InitialisationSetupDraft {
  const year = new Date().getFullYear();
  return {
    etablissement_id: etablissementId,
    include_site_principal: true,
    site_principal_nom: "Site principal",
    site_principal_adresse: "",
    site_principal_telephone: "",
    create_initial_year: true,
    annee_nom: `${year}-${year + 1}`,
    annee_date_debut: `${year}-09-01`,
    annee_date_fin: `${year + 1}-07-31`,
    periods_strategy: "STANDARD",
    periods_template_code: "TRIMESTRES",
    custom_periods: [],
    selected_level_presets: ["PRIMAIRE"],
    manual_selected_level_codes: [""],
    selected_level_codes: ["CP", "CE1", "CE2", "CM1", "CM2"],
    custom_levels: "",
    classes_by_level: [],
    academic_by_level: [],
    finance_catalogues: [],
    selected_role_names: DEFAULT_SECURITY_ROLE_NAMES,
    classes_mode: "CREATION",
    academic_mode: "PLUS_TARD",
    security_mode: "CREATION",
    finance_mode: "PLUS_TARD",
    services_mode: "PLUS_TARD",
    audit_mode: "PLUS_TARD",
  };
}

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

  return "Une erreur est survenue pendant le wizard d'initialisation.";
}

function parseFinanceAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getFinanceNavigationIssue(draft: InitialisationSetupDraft) {
  if (draft.finance_mode !== "CREATION") {
    return null;
  }

  if (draft.finance_catalogues.length === 0) {
    return "Ajoute au moins un frais catalogue avant de passer a l'etape suivante.";
  }

  const cataloguesSansMontant = draft.finance_catalogues.filter((catalogue) => {
    const amount = parseFinanceAmount(catalogue.montant);
    return amount === null || amount < 0;
  });

  if (cataloguesSansMontant.length === 0) {
    return null;
  }

  const labels = cataloguesSansMontant
    .slice(0, 3)
    .map((catalogue) => catalogue.nom.trim() || "Frais sans nom")
    .join(", ");
  const suffix =
    cataloguesSansMontant.length > 3
      ? ` et ${cataloguesSansMontant.length - 3} autre(s)`
      : "";

  return `Renseigne le montant de tous les frais avant de continuer : ${labels}${suffix}.`;
}

export default function InitialisationWizard({
  etablissementId,
  templates,
  onClose,
  onCompleted,
  onHeaderActionsChange,
  onScrollTopRequest,
}: Props) {
  const { info } = useInfo();
  const { step, preview, report, setStep, setPreview, setReport, reset } =
    useInitialisationWizardStore();
  const [draft, setDraft] = useState<InitialisationSetupDraft>(
    buildDefaultDraft(etablissementId),
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    setDraft(buildDefaultDraft(etablissementId));
    reset();

    return () => reset();
  }, [etablissementId, reset]);

  useEffect(() => {
    setDraft((current) => {
      const nextSelectedLevelCodes = buildSelectedLevelCodes(
        templates,
        current.selected_level_presets,
        current.manual_selected_level_codes,
      );

      if (
        areStringArraysEqual(
          current.selected_level_codes,
          nextSelectedLevelCodes,
        )
      ) {
        return current;
      }

      return {
        ...current,
        selected_level_codes: nextSelectedLevelCodes,
      };
    });
  }, [
    draft.selected_level_presets,
    draft.manual_selected_level_codes,
    templates,
  ]);

  useEffect(() => {
    if (!templates?.periodes_standards?.length) return;

    setDraft((current) => {
      const selectedTemplate = getSelectedPeriodTemplate(
        templates,
        current.periods_template_code,
      );

      if (
        !selectedTemplate ||
        selectedTemplate.code === current.periods_template_code
      ) {
        return current;
      }

      return {
        ...current,
        periods_template_code: selectedTemplate.code,
      };
    });
  }, [templates]);

  useEffect(() => {
    if (!templates?.roles_standards?.length) return;

    setDraft((current) => {
      const availableRoleNames = templates.roles_standards.map(
        (role) => role.nom,
      );
      const nextSelectedRoleNames = current.selected_role_names.filter(
        (roleName) => availableRoleNames.includes(roleName),
      );

      if (
        areStringArraysEqual(current.selected_role_names, nextSelectedRoleNames)
      ) {
        return current;
      }

      return {
        ...current,
        selected_role_names: nextSelectedRoleNames,
      };
    });
  }, [templates]);

  const resolvedLevels = useMemo(
    () =>
      resolveDraftLevels(
        {
          selected_level_codes: draft.selected_level_codes,
          custom_levels: draft.custom_levels,
        },
        templates,
      ),
    [draft.selected_level_codes, draft.custom_levels, templates],
  );

  useEffect(() => {
    setDraft((current) => {
      const nextGroups = syncClassGroups(
        resolvedLevels,
        current.classes_by_level,
      );

      if (areClassGroupsEqual(current.classes_by_level, nextGroups)) {
        return current;
      }

      return {
        ...current,
        classes_by_level: nextGroups,
      };
    });
  }, [resolvedLevels]);

  useEffect(() => {
    setDraft((current) => {
      const nextGroups = syncAcademicGroups(
        resolvedLevels,
        current.academic_by_level,
      );

      if (areAcademicGroupsEqual(current.academic_by_level, nextGroups)) {
        return current;
      }

      return {
        ...current,
        academic_by_level: nextGroups,
      };
    });
  }, [resolvedLevels]);

  useEffect(() => {
    const validLevelCodes = new Set(resolvedLevels.map((level) => level.code));

    setDraft((current) => {
      const validClassKeys = new Set(
        current.classes_by_level.flatMap((group) =>
          group.class_names
            .map((className) => className.trim())
            .filter(Boolean)
            .map(
              (className) => `${group.level_code}::${className.toLowerCase()}`,
            ),
        ),
      );
      const nextCatalogues = current.finance_catalogues.map((catalogue) => {
        if (
          catalogue.level_code &&
          !validLevelCodes.has(catalogue.level_code)
        ) {
          return {
            ...catalogue,
            level_code: "",
            class_name: "",
          };
        }

        if (
          catalogue.class_name &&
          !validClassKeys.has(
            `${catalogue.level_code}::${catalogue.class_name.trim().toLowerCase()}`,
          )
        ) {
          return {
            ...catalogue,
            class_name: "",
          };
        }

        return catalogue;
      });
      const changed = nextCatalogues.some(
        (catalogue, index) =>
          catalogue.level_code !==
            current.finance_catalogues[index]?.level_code ||
          catalogue.class_name !==
            current.finance_catalogues[index]?.class_name,
      );

      if (!changed) {
        return current;
      }

      return {
        ...current,
        finance_catalogues: nextCatalogues,
      };
    });
  }, [draft.classes_by_level, resolvedLevels]);

  const steps = useMemo(
    () => [
      {
        title: "Etablissement",
        subtitle: "Site principal et reperes d'exploitation",
        icon: <FiMapPin />,
        content: <StepEtablissementBase draft={draft} setDraft={setDraft} />,
      },
      {
        title: "Annee initiale",
        subtitle: "Cadre temporel du premier cycle d'exploitation",
        icon: <FiCalendar />,
        content: (
          <StepAnneeInitiale
            draft={draft}
            setDraft={setDraft}
            templates={templates}
          />
        ),
      },
      {
        title: "Niveaux",
        subtitle: "Selection du socle pedagogique de depart",
        icon: <FiLayers />,
        content: (
          <StepNiveaux
            draft={draft}
            setDraft={setDraft}
            templates={templates}
          />
        ),
      },
      {
        title: "Classes",
        subtitle: "Generation prudente de la structure classe",
        icon: <FiChevronRight />,
        content: (
          <StepClasses
            draft={draft}
            setDraft={setDraft}
            levels={resolvedLevels}
          />
        ),
      },
      {
        title: "Academique",
        subtitle: "Matieres, programmes et maquettes",
        icon: <FiBookOpen />,
        content: (
          <StepAcademique
            draft={draft}
            setDraft={setDraft}
            levels={resolvedLevels}
          />
        ),
      },
      {
        title: "Securite",
        subtitle: "Roles et habilitations cibles",
        icon: <FiShield />,
        content: (
          <StepSecurite
            draft={draft}
            setDraft={setDraft}
            templates={templates}
          />
        ),
      },
      {
        title: "Finance",
        subtitle: "Socle de facturation et cadrage financier",
        icon: <FiCheckCircle />,
        content: (
          <StepFinance
            draft={draft}
            setDraft={setDraft}
            levels={resolvedLevels}
          />
        ),
      },
      {
        title: "Audit",
        subtitle: "Notifications et traceabilite du demarrage",
        icon: <FiClock />,
        content: <StepAuditNotifications draft={draft} setDraft={setDraft} />,
      },
      {
        title: "Resume",
        subtitle: "Lecture finale avant execution",
        icon: <FiCheckCircle />,
        content: <StepResumeGeneration preview={preview} />,
      },
    ],
    [draft, preview, resolvedLevels, templates],
  );

  const progress = Math.round(((step + 1) / steps.length) * 100);
  const isLastStep = step === steps.length - 1;
  const financeStepIndex = steps.findIndex((item) => item.title === "Finance");
  const financeNavigationIssue = getFinanceNavigationIssue(draft);
  const isFinanceNextBlocked =
    step === financeStepIndex && Boolean(financeNavigationIssue);
  const selectedLevelCount = resolvedLevels.length;
  const plannedPeriodCount = countConfiguredPeriods(draft, templates);
  const plannedClassCount = countEnteredClasses(draft.classes_by_level);
  const plannedAcademicSubjectCount = countEnteredAcademicSubjects(
    draft.academic_by_level,
  );
  const selectedRoleCount = draft.selected_role_names.length;
  const deferredCount = [
    draft.classes_mode,
    draft.academic_mode,
    draft.security_mode,
    draft.finance_mode,
    draft.audit_mode,
  ].filter((mode) => mode === "PLUS_TARD").length;

  const handlePreview = useCallback(async () => {
    setIsPreviewing(true);
    try {
      const response =
        await InitialisationEtablissementService.previewInitialSetup(draft);
      setPreview(response.data ?? null);
      info("Previsualisation mise a jour.", "success");
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setIsPreviewing(false);
    }
  }, [draft, info, setPreview]);

  const handleCommit = useCallback(async () => {
    setIsCommitting(true);
    try {
      const response =
        await InitialisationEtablissementService.commitInitialSetup(draft);
      const result = (response.data ??
        null) as InitialisationCommitResult | null;
      setReport(result);
      if (result) {
        void onCompleted(result);
      }
      info("Initialisation executee.", "success");
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setIsCommitting(false);
    }
  }, [draft, info, onCompleted, setReport]);

  const closeWithReport = useCallback(() => {
    onClose();
  }, [onClose]);

  const goToStep = useCallback(
    (nextStep: number) => {
      const normalizedNextStep = Math.min(
        steps.length - 1,
        Math.max(0, nextStep),
      );
      const triesToMovePastFinance =
        financeStepIndex >= 0 &&
        step <= financeStepIndex &&
        normalizedNextStep > financeStepIndex;

      if (triesToMovePastFinance && financeNavigationIssue) {
        info(financeNavigationIssue, "warning");
        setStep(financeStepIndex);
        onScrollTopRequest?.();
        return;
      }

      setStep(normalizedNextStep);

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          onScrollTopRequest?.();
        });
      } else {
        onScrollTopRequest?.();
      }
    },
    [
      financeNavigationIssue,
      financeStepIndex,
      info,
      onScrollTopRequest,
      setStep,
      step,
      steps.length,
    ],
  );

  const goToStepRef = useRef(goToStep);
  const handlePreviewRef = useRef(handlePreview);
  const handleCommitRef = useRef(handleCommit);
  const closeWithReportRef = useRef(closeWithReport);

  useEffect(() => {
    goToStepRef.current = goToStep;
  }, [goToStep]);

  useEffect(() => {
    handlePreviewRef.current = handlePreview;
  }, [handlePreview]);

  useEffect(() => {
    handleCommitRef.current = handleCommit;
  }, [handleCommit]);

  useEffect(() => {
    closeWithReportRef.current = closeWithReport;
  }, [closeWithReport]);

  const headerActions = useMemo(() => {
    if (report) {
      return (
        <button
          type="button"
          onClick={() => closeWithReportRef.current()}
          className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Fermer
        </button>
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={() => goToStepRef.current(step - 1)}
          disabled={step === 0}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Retour
        </button>

        {!isLastStep ? (
          <button
            type="button"
            onClick={() => goToStepRef.current(step + 1)}
            disabled={isFinanceNextBlocked}
            title={financeNavigationIssue ?? undefined}
            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Suivant
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void handlePreviewRef.current()}
              disabled={isPreviewing}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {isPreviewing ? "Previsualisation..." : "Previsualiser"}
            </button>
            <button
              type="button"
              onClick={() => void handleCommitRef.current()}
              disabled={isCommitting || !preview}
              className="rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isCommitting ? "Generation..." : "Generer"}
            </button>
          </>
        )}
      </>
    );
  }, [
    isCommitting,
    isFinanceNextBlocked,
    isLastStep,
    isPreviewing,
    financeNavigationIssue,
    preview,
    report,
    step,
  ]);

  useEffect(() => {
    onHeaderActionsChange?.(headerActions);

    return () => {
      onHeaderActionsChange?.(null);
    };
  }, [headerActions, onHeaderActionsChange]);

  if (report) {
    return <GenerationReport report={report} />;
  }

  return (
    <div className="min-w-0 grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-2 xl:self-start">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#155e75_100%)] p-5 text-white shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/90">
            Nouvel etablissement
          </p>
          <h3 className="mt-3 text-xl font-semibold">Initialisation guidee</h3>
          <p className="mt-2 text-sm leading-6 text-slate-100/90">
            On structure le socle utile maintenant, sans te noyer dans tous les
            referentiels.
          </p>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/90">
              <span>Progression</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-2">
            {steps.map((item, index) => {
              const active = step === index;
              const done = step > index;

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => goToStep(index)}
                  className={`flex w-full items-start gap-3 rounded-[20px] px-3 py-3 text-left transition ${
                    active ? "bg-cyan-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                      active
                        ? "bg-cyan-100 text-cyan-700"
                        : done
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Reperes rapides
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[20px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">Niveaux</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {selectedLevelCount}
              </p>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">Periodes</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {plannedPeriodCount}
              </p>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">Classes</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {plannedClassCount}
              </p>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">Matieres</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {plannedAcademicSubjectCount}
              </p>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">Roles</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {selectedRoleCount}
              </p>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">
                Blocs differes
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {deferredCount}
              </p>
            </div>
          </div>
        </section>
      </aside>

      <div className="min-w-0 space-y-5">
        <section className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Etape {step + 1} sur {steps.length}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {steps[step]?.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {steps[step]?.subtitle}
              </p>
            </div>

            {isLastStep && preview ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Previsualisation prete
              </span>
            ) : null}
          </div>
        </section>

        <section className="min-w-0 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm">
          {steps[step]?.content}
        </section>
      </div>
    </div>
  );
}
