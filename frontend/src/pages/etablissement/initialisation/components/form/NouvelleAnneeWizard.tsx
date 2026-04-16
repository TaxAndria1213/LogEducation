import { useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiCheckCircle,
  FiCopy,
  FiRefreshCw,
} from "react-icons/fi";
import { useInfo } from "../../../../../hooks/useInfo";
import InitialisationEtablissementService from "../../../../../services/initialisationEtablissement.service";
import type {
  InitialisationCommitResult,
  InitialisationPreview,
  InitialisationStatus,
  NouvelleAnneeDraft,
} from "../../types";
import GenerationReport from "../shared/GenerationReport";
import ResumeDiffPanel from "../shared/ResumeDiffPanel";
import BlockActionSelector from "../shared/BlockActionSelector";

type Props = {
  etablissementId: string;
  status: InitialisationStatus | null;
  onClose: () => void;
  onCompleted: (result: InitialisationCommitResult) => void;
};

function buildDraft(
  etablissementId: string,
  status: InitialisationStatus | null,
): NouvelleAnneeDraft {
  const activeYear = status?.active_year;
  const startYear = activeYear?.date_fin
    ? new Date(activeYear.date_fin).getFullYear() + 1
    : new Date().getFullYear();

  return {
    etablissement_id: etablissementId,
    nom: `${startYear}-${startYear + 1}`,
    date_debut: `${startYear}-09-01`,
    date_fin: `${startYear + 1}-07-31`,
    source_annee_id: activeYear?.id ?? "",
    copy_periodes: true,
    close_current_year: true,
    references_mode: "REPRISE",
    finance_mode: "PLUS_TARD",
    services_mode: "PLUS_TARD",
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

  return "Une erreur est survenue pendant la preparation de la nouvelle annee.";
}

export default function NouvelleAnneeWizard({
  etablissementId,
  status,
  onClose,
  onCompleted,
}: Props) {
  const { info } = useInfo();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<NouvelleAnneeDraft>(
    buildDraft(etablissementId, status),
  );
  const [preview, setPreview] = useState<InitialisationPreview | null>(null);
  const [report, setReport] = useState<InitialisationCommitResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    setDraft(buildDraft(etablissementId, status));
    setStep(0);
    setPreview(null);
    setReport(null);
  }, [etablissementId, status]);

  const steps = useMemo(
    () => [
      {
        title: "Cadrage",
        subtitle: "Nom, bornes calendaires et annee source",
        icon: <FiCalendar />,
        content: (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Libelle</span>
                <input
                  value={draft.nom}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, nom: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Date debut</span>
                <input
                  type="date"
                  value={draft.date_debut}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      date_debut: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Date fin</span>
                <input
                  type="date"
                  value={draft.date_fin}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, date_fin: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Annee source
              </span>
              <input
                value={draft.source_annee_id}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    source_annee_id: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                placeholder="ID de l'annee source"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                <input
                  type="checkbox"
                  checked={draft.copy_periodes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      copy_periodes: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    Reprendre les periodes
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    Recale les periodes de l'annee source sur la nouvelle plage.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                <input
                  type="checkbox"
                  checked={draft.close_current_year}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      close_current_year: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    Cloturer l'annee active
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    Bascule proprement la reference annuelle sur la nouvelle annee.
                  </span>
                </span>
              </label>
            </div>
          </div>
        ),
      },
      {
        title: "Referentiels",
        subtitle: "Ce qui est repris tel quel ou revu plus tard",
        icon: <FiCopy />,
        content: (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              La nouvelle annee s'appuie d'abord sur les referentiels stables deja connus.
            </p>
            <BlockActionSelector
              value={draft.references_mode}
              onChange={(value) =>
                setDraft((current) => ({ ...current, references_mode: value }))
              }
            />
          </div>
        ),
      },
      {
        title: "Finance & services",
        subtitle: "Cadrage de la reprise differenciee",
        icon: <FiRefreshCw />,
        content: (
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-900">Finance</p>
              <BlockActionSelector
                value={draft.finance_mode}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, finance_mode: value }))
                }
              />
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-900">Transport & cantine</p>
              <BlockActionSelector
                value={draft.services_mode}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, services_mode: value }))
                }
              />
            </div>
          </div>
        ),
      },
      {
        title: "Resume",
        subtitle: "Validation finale avant generation",
        icon: <FiCheckCircle />,
        content: <ResumeDiffPanel preview={preview} />,
      },
    ],
    [draft, preview],
  );

  const progress = Math.round(((step + 1) / steps.length) * 100);
  const isLastStep = step === steps.length - 1;
  const deferredCount = [draft.finance_mode, draft.services_mode].filter(
    (mode) => mode === "PLUS_TARD",
  ).length;

  const handlePreview = async () => {
    setIsPreviewing(true);
    try {
      const response = await InitialisationEtablissementService.previewNewSchoolYear(draft);
      setPreview((response.data ?? null) as InitialisationPreview | null);
      info("Previsualisation de la nouvelle annee mise a jour.", "success");
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    try {
      const response = await InitialisationEtablissementService.commitNewSchoolYear(draft);
      setReport((response.data ?? null) as InitialisationCommitResult | null);
      info("Nouvelle annee scolaire creee.", "success");
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setIsCommitting(false);
    }
  };

  if (report) {
    return (
      <div className="space-y-6">
        <GenerationReport report={report} />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              onCompleted(report);
              onClose();
            }}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-2 xl:self-start">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#164e63_0%,#0f172a_100%)] p-5 text-white shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/90">
            Nouvelle annee scolaire
          </p>
          <h3 className="mt-3 text-xl font-semibold">Generation N+1</h3>
          <p className="mt-2 text-sm leading-6 text-slate-100/90">
            On cree la nouvelle annee, on reprend les periodes si besoin, puis on cadre les blocs
            qui demandent encore une validation metier.
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Reference actuelle
          </p>
          <div className="mt-4 rounded-[20px] bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">
              {status?.active_year?.nom ?? "Aucune annee active"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {status?.active_year
                ? "Cette annee sert de point d'appui par defaut pour la reprise."
                : "Le parcours reste possible, mais sans base de reprise directe."}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">Periodes</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {draft.copy_periodes ? "Oui" : "Non"}
              </p>
            </div>
            <div className="rounded-[18px] bg-slate-50 px-3 py-3">
              <p className="text-xs font-medium text-slate-500">Blocs differes</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{deferredCount}</p>
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
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.subtitle}</p>
                  </div>
                </button>
              );
            })}
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
                ? "Previsualise la creation avant de generer la nouvelle annee."
                : "Tu peux naviguer librement entre les etapes pour ajuster la reprise."}
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
