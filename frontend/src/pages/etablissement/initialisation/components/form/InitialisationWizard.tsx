import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiLayers,
  FiMapPin,
  FiSettings,
  FiShield,
  FiTruck,
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
import StepOrganisation from "../steps/StepOrganisation";
import StepResumeGeneration from "../steps/StepResumeGeneration";
import StepSecurite from "../steps/StepSecurite";
import StepServicesAnnexes from "../steps/StepServicesAnnexes";
import { useInitialisationWizardStore } from "../../store/InitialisationWizardStore";
import {
  areAcademicGroupsEqual,
  countEnteredAcademicSubjects,
  syncAcademicGroups,
} from "../../utils/academics";
import {
  areClassGroupsEqual,
  countEnteredClasses,
  resolveDraftLevels,
  syncClassGroups,
} from "../../utils/levels";

type Props = {
  etablissementId: string;
  templates: InitialisationTemplates | null;
  onClose: () => void;
  onCompleted: (result: InitialisationCommitResult) => void;
};

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
    selected_level_codes: ["CP", "CE1", "CE2", "CM1", "CM2", "6E"],
    custom_levels: "",
    classes_by_level: [],
    academic_by_level: [],
    create_default_departements: true,
    classes_mode: "CREATION",
    academic_mode: "CREATION",
    security_mode: "PLUS_TARD",
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

export default function InitialisationWizard({
  etablissementId,
  templates,
  onClose,
  onCompleted,
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
      const nextGroups = syncClassGroups(resolvedLevels, current.classes_by_level);

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
      const nextGroups = syncAcademicGroups(resolvedLevels, current.academic_by_level);

      if (areAcademicGroupsEqual(current.academic_by_level, nextGroups)) {
        return current;
      }

      return {
        ...current,
        academic_by_level: nextGroups,
      };
    });
  }, [resolvedLevels]);

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
        content: <StepAnneeInitiale draft={draft} setDraft={setDraft} />,
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
        title: "Organisation",
        subtitle: "Departements et premiers reperes administratifs",
        icon: <FiSettings />,
        content: (
          <StepOrganisation
            draft={draft}
            setDraft={setDraft}
            templates={templates}
          />
        ),
      },
      {
        title: "Securite",
        subtitle: "Roles et habilitations cibles",
        icon: <FiShield />,
        content: <StepSecurite draft={draft} setDraft={setDraft} />,
      },
      {
        title: "Finance",
        subtitle: "Socle de facturation et cadrage financier",
        icon: <FiCheckCircle />,
        content: <StepFinance draft={draft} setDraft={setDraft} />,
      },
      {
        title: "Services",
        subtitle: "Transport, cantine et blocs annexes",
        icon: <FiTruck />,
        content: <StepServicesAnnexes draft={draft} setDraft={setDraft} />,
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
  const selectedLevelCount = resolvedLevels.length;
  const plannedClassCount = countEnteredClasses(draft.classes_by_level);
  const plannedAcademicSubjectCount = countEnteredAcademicSubjects(draft.academic_by_level);
  const deferredCount = [
    draft.classes_mode,
    draft.academic_mode,
    draft.security_mode,
    draft.finance_mode,
    draft.services_mode,
    draft.audit_mode,
  ].filter((mode) => mode === "PLUS_TARD").length;

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      const response = await InitialisationEtablissementService.previewInitialSetup(draft);
      setPreview(response.data ?? null);
      info("Previsualisation mise a jour.", "success");
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    try {
      const response = await InitialisationEtablissementService.commitInitialSetup(draft);
      setReport((response.data ?? null) as InitialisationCommitResult | null);
      info("Initialisation executee.", "success");
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setIsCommitting(false);
    }
  };

  const closeWithReport = () => {
    if (report) {
      onCompleted(report);
    }
    onClose();
  };

  if (report) {
    return (
      <div className="space-y-6">
        <GenerationReport report={report} />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={closeWithReport}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            Fermer
          </button>
        </div>
      </div>
    );
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
            On structure le socle utile maintenant, sans te noyer dans tous les referentiels.
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
                  onClick={() => setStep(index)}
                  className={`flex w-full items-start gap-3 rounded-[20px] px-3 py-3 text-left transition ${
                    active
                      ? "bg-cyan-50"
                      : "hover:bg-slate-50"
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
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.subtitle}</p>
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
              <p className="mt-1 text-xl font-semibold text-slate-900">{selectedLevelCount}</p>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">Classes</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{plannedClassCount}</p>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">Matieres</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {plannedAcademicSubjectCount}
              </p>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">Blocs differes</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{deferredCount}</p>
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

        <section className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              {isLastStep
                ? "Verifie la previsualisation avant d'executer."
                : "Tu peux avancer librement dans le wizard et revenir sur une etape a tout moment."}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Retour
              </button>

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => setStep(Math.min(steps.length - 1, step + 1))}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                >
                  Suivant
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void handlePreview()}
                    disabled={isPreviewing}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    {isPreviewing ? "Previsualisation..." : "Previsualiser"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCommit()}
                    disabled={isCommitting || !preview}
                    className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isCommitting ? "Generation..." : "Generer"}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
