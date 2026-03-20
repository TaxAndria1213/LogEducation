/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, type ReactNode } from "react";
import { FiArrowLeft, FiCheck, FiChevronRight } from "react-icons/fi";
import { Form } from "../Form";

type StepKey = string;

export type WizardStep = {
  key: StepKey;
  title: string;
  desc?: string;
  schema: any;
  fields: any[];
  initialValues?: Record<string, any>;
  labelMessage?: string;
  icon?: ReactNode;
};

type WizardData = Record<string, any>;

type MultiStepFormWizardProps = {
  title?: string;
  subtitle?: string;
  steps: WizardStep[];
  onFinish: (data: WizardData) => void | Promise<void>;
  onStepChange?: (stepIndex: number, allData: WizardData) => void;
  onReset?: () => void;
  footerRight?: ReactNode;
  submitHint?: ReactNode;
};

function getPreviewValue(data: Record<string, any> | undefined) {
  if (!data) return "";

  const preferredKeys = [
    "prenom",
    "nom",
    "code_eleve",
    "classe_id",
    "mode_paiement",
    "relation",
  ];

  const values: string[] = [];

  for (const key of preferredKeys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      values.push(value.trim());
    }
  }

  if (values.length > 0) {
    return values.slice(0, 2).join(" · ");
  }

  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "Oui" : "Non";
  }

  return "";
}

export function MultiStepFormWizard({
  title = "Formulaire multi-etapes",
  subtitle = "Completez les etapes. Vous pouvez revenir en arriere a tout moment.",
  steps,
  onFinish,
  onStepChange,
  onReset,
  footerRight,
  submitHint,
}: MultiStepFormWizardProps) {
  const [step, setStep] = useState(0);
  const [allData, setAllData] = useState<WizardData>({});
  const [completed, setCompleted] = useState<Record<number, boolean>>({});

  const progress = useMemo(
    () => ((step + 1) / steps.length) * 100,
    [step, steps.length],
  );
  const current = steps[step];

  const canJumpTo = (s: number) => s <= step || !!completed[s];

  const goBack = () => setStep((s) => (s === 0 ? 0 : s - 1));

  const jumpTo = (s: number) => {
    if (canJumpTo(s)) setStep(s);
  };

  const resetAll = () => {
    setAllData({});
    setCompleted({});
    setStep(0);
    onReset?.();
  };

  const handleStepSubmit = async (data: any) => {
    const updatedData = { ...allData, [current.key]: data };

    setAllData(updatedData);
    setCompleted((prev) => ({ ...prev, [step]: true }));

    if (step < steps.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      onStepChange?.(nextStep, updatedData);
      return;
    }

    await onFinish(updatedData);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_34%),linear-gradient(180deg,_#f8fbff_0%,_#ffffff_34%)]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-5 rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Inscription guidee
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
              <span>Progression</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((item, index) => {
              const isActive = step === index;
              const isDone = !!completed[index];
              const enabled = canJumpTo(index);
              const preview = getPreviewValue(allData[item.key]);

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => jumpTo(index)}
                  disabled={!enabled}
                  className={`w-full rounded-[24px] border p-4 text-left transition ${
                    isActive
                      ? "border-sky-300 bg-sky-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  } ${enabled ? "" : "cursor-not-allowed opacity-50"}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                        isDone
                          ? "bg-emerald-100 text-emerald-700"
                          : isActive
                            ? "bg-sky-100 text-sky-700"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isDone ? <FiCheck /> : item.icon ?? index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <FiChevronRight
                          className={isActive ? "text-sky-600" : "text-slate-300"}
                        />
                      </div>
                      {item.desc ? (
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</p>
                      ) : null}
                      {preview ? (
                        <p className="mt-3 truncate text-xs font-medium text-slate-600">
                          {preview}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Resume
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {steps.map((item, index) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      completed[index]
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {completed[index] ? <FiCheck /> : index + 1}
                  </span>
                  <span>
                    {completed[index]
                      ? `${item.title} renseigne`
                      : `${item.title} a completer`}
                  </span>
                </div>
              ))}
            </div>

            {Object.keys(completed).length > 0 ? (
              <button
                type="button"
                onClick={resetAll}
                className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Reinitialiser
              </button>
            ) : null}
          </div>
        </aside>

        <main className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Etape {step + 1} sur {steps.length}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  {current.icon ?? step + 1}
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">{current.title}</h3>
                  {current.desc ? (
                    <p className="mt-1 text-sm leading-6 text-slate-500">{current.desc}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiArrowLeft />
              Retour
            </button>
          </div>

          <div className="mt-6 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(248,250,252,0.92),_rgba(255,255,255,0.96))] p-5 md:p-6">
            <Form
              key={current.key}
              schema={current.schema}
              fields={current.fields}
              initialValues={allData[current.key] ?? current.initialValues ?? {}}
              dataOnly={handleStepSubmit}
              labelMessage={current.labelMessage ?? current.title}
              submitLabel={
                step === steps.length - 1 ? "Finaliser l'inscription" : "Enregistrer et continuer"
              }
              submitAlign="end"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-sm text-slate-600">
              {submitHint ?? (
                <>
                  Enregistrez chaque etape pour conserver les donnees et passer a la
                  suivante.
                </>
              )}
            </div>
            {footerRight}
          </div>
        </main>
      </div>
    </div>
  );
}
