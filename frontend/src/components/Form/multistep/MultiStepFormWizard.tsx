/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, type ReactNode } from "react";
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

export function MultiStepFormWizard({
  title = "Formulaire multi-étapes",
  subtitle = "Complétez les étapes. Vous pouvez revenir en arrière à tout moment.",
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
    const currentKey = current.key;
    const updatedData = { ...allData, [currentKey]: data };

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

  const StepDot = ({
    index,
    title,
    desc,
  }: {
    index: number;
    title: string;
    desc?: string;
  }) => {
    const isActive = step === index;
    const isDone = !!completed[index];
    const enabled = canJumpTo(index);

    return (
      <button
        type="button"
        onClick={() => jumpTo(index)}
        disabled={!enabled}
        style={{
          all: "unset",
          cursor: enabled ? "pointer" : "not-allowed",
          opacity: enabled ? 1 : 0.5,
          display: "grid",
          gridTemplateColumns: "24px 1fr",
          gap: 10,
          alignItems: "start",
          padding: "10px 12px",
          borderRadius: 10,
          border: isActive
            ? "1px solid rgba(59,130,246,.6)"
            : "1px solid rgba(0,0,0,.08)",
          background: isActive ? "rgba(59,130,246,.06)" : "white",
        }}
        aria-current={isActive ? "step" : undefined}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            border: isActive
              ? "2px solid rgba(59,130,246,1)"
              : "2px solid rgba(0,0,0,.15)",
            background: isDone ? "rgba(34,197,94,.12)" : "transparent",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {isDone ? "✓" : index + 1}
        </div>

        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ lineHeight: 1.1 }}>{title}</div>
          {desc && <div style={{ fontSize: 12, opacity: 0.7 }}>{desc}</div>}
        </div>
      </button>
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "28px 18px 28px",
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 18,
        }}
      >
        <aside
          style={{
            position: "sticky",
            top: 18,
            alignSelf: "start",
            border: "1px solid rgba(0,0,0,.08)",
            borderRadius: 14,
            background: "white",
            padding: 14,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 16 }}>{title}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              <span>Progression</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "rgba(0,0,0,.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "rgba(59,130,246,1)",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {steps.map((item, index) => (
              <StepDot
                key={item.key}
                index={index}
                title={item.title}
                desc={item.desc}
              />
            ))}
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(0,0,0,.08)",
              paddingTop: 10,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>Résumé</div>
            <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
              {steps.map((item, index) => (
                <div key={item.key}>
                  {completed[index]
                    ? `✓ ${item.title} renseigné`
                    : `• ${item.title} à compléter`}
                </div>
              ))}
            </div>

            {Object.keys(completed).length > 0 && (
              <button
                type="button"
                onClick={resetAll}
                className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-black font-bold py-2 px-3 rounded"
                style={{ justifySelf: "start", fontSize: 13 }}
              >
                Réinitialiser
              </button>
            )}
          </div>
        </aside>

        <main
          style={{
            border: "1px solid rgba(0,0,0,.08)",
            borderRadius: 14,
            background: "white",
            padding: 18,
            // display: "grid",
            gap: 14,
          }}
        >
          <header style={{ display: "grid", gap: 6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 18 }}>{current.title}</div>
                {current.desc && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {current.desc}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-black font-bold py-2 px-3 rounded"
                style={{ opacity: step === 0 ? 0.5 : 1 }}
              >
                ← Retour
              </button>
            </div>
          </header>

          <div style={{marginTop: 18}}>
            <Form
              key={current.key}
              schema={current.schema}
              fields={current.fields}
              initialValues={
                allData[current.key] ?? current.initialValues ?? {}
              }
              dataOnly={handleStepSubmit}
              labelMessage={current.labelMessage ?? current.title}
            />
          </div>
        </main>
      </div>

      <div
        style={{
          // position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          borderTop: "1px solid rgba(0,0,0,.08)",
          background: "rgba(255,255,255,.92)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Étape <b>{step + 1}</b> sur <b>{steps.length}</b>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0}
              className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-black font-bold py-2 px-4 rounded"
              style={{ opacity: step === 0 ? 0.5 : 1 }}
            >
              Retour
            </button>

            {footerRight}

            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(59,130,246,.06)",
                border: "1px solid rgba(59,130,246,.2)",
                fontSize: 12,
                opacity: 0.85,
              }}
            >
              {submitHint ?? (
                <>
                  Cliquez sur <b>Enregistrer</b> pour passer à l’étape suivante.
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
