import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { BooleanField } from "../../../../../components/Form/fields/BooleanField";
import { FloatField } from "../../../../../components/Form/fields/FloatField";
import { IntField } from "../../../../../components/Form/fields/IntField";
import { SelectField } from "../../../../../components/Form/fields/SelectField";
import { TextAreaField } from "../../../../../components/Form/fields/TextAreaField";
import { TextField } from "../../../../../components/Form/fields/TextField";
import type {
  InitialisationClassGroup,
  InitialisationFinanceCatalogueDraft,
  InitialisationSetupDraft,
} from "../../types";
import type { DraftLevelDefinition } from "../../utils/levels";
import BlockActionSelector from "../shared/BlockActionSelector";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
  levels: DraftLevelDefinition[];
};

type FormValues = Pick<InitialisationSetupDraft, "finance_catalogues">;

type PlannedClass = {
  key: string;
  level_code: string;
  level_nom: string;
  class_name: string;
};

const usageScopeOptions = [
  { value: "INSCRIPTION", label: "Inscription" },
  { value: "SCOLARITE", label: "Scolarite" },
  { value: "EXAMEN", label: "Examen" },
  { value: "UNIFORME", label: "Uniforme" },
  { value: "FOURNITURE", label: "Fourniture" },
  { value: "GENERAL", label: "General" },
];

const periodiciteOptions = [
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "monthly", label: "Mensuel" },
  { value: "term", label: "Par trimestre" },
  { value: "semester", label: "Semestriel" },
  { value: "year", label: "Annuel" },
];

const deviseOptions = ["MGA", "EUR", "USD"];

function buildClassKey(levelCode: string, className: string) {
  return `${levelCode}::${className.trim().toLowerCase()}`;
}

function resolvePlannedClasses(
  groups: InitialisationClassGroup[],
): PlannedClass[] {
  return groups.flatMap((group) => {
    const uniqueClassNames = Array.from(
      new Set(
        group.class_names.map((className) => className.trim()).filter(Boolean),
      ),
    );

    return uniqueClassNames.map((className) => ({
      key: buildClassKey(group.level_code, className),
      level_code: group.level_code,
      level_nom: group.level_nom,
      class_name: className,
    }));
  });
}

function resolveDefaultName(usageScope: string, className?: string) {
  const suffix = className ? ` - ${className}` : "";

  switch (usageScope) {
    case "INSCRIPTION":
      return `Droit d'inscription${suffix}`;
    case "SCOLARITE":
      return `Frais de scolarite${suffix}`;
    case "EXAMEN":
      return `Frais d'examen${suffix}`;
    case "UNIFORME":
      return `Uniforme${suffix}`;
    case "FOURNITURE":
      return `Fournitures${suffix}`;
    default:
      return `Frais general${suffix}`;
  }
}

function buildEmptyCatalogue(
  levelCode = "",
  className = "",
  usageScope = "SCOLARITE",
): InitialisationFinanceCatalogueDraft {
  const isRecurring = usageScope === "SCOLARITE";

  return {
    level_code: levelCode,
    class_name: className,
    usage_scope: usageScope,
    nom: resolveDefaultName(usageScope, className),
    description: "",
    montant: "",
    devise: "MGA",
    nombre_tranches: isRecurring ? "10" : "1",
    est_recurrent: isRecurring,
    periodicite: isRecurring ? "monthly" : "",
    prorata_eligible: false,
    eligibilite_json: "",
  };
}

function buildMissingClassCatalogues(
  plannedClasses: PlannedClass[],
  existingCatalogues: InitialisationFinanceCatalogueDraft[],
) {
  const existingTargets = new Set(
    existingCatalogues.map(
      (catalogue) =>
        `${buildClassKey(catalogue.level_code, catalogue.class_name)}::${catalogue.usage_scope}`,
    ),
  );

  return plannedClasses.flatMap((plannedClass) => {
    const defaults = ["INSCRIPTION", "SCOLARITE"];
    return defaults
      .filter(
        (usageScope) =>
          !existingTargets.has(`${plannedClass.key}::${usageScope}`),
      )
      .map((usageScope) =>
        buildEmptyCatalogue(
          plannedClass.level_code,
          plannedClass.class_name,
          usageScope,
        ),
      );
  });
}

function isCatalogueComplete(catalogue: InitialisationFinanceCatalogueDraft) {
  const amount = Number(String(catalogue.montant).replace(",", "."));
  return (
    Boolean(catalogue.nom.trim()) && Number.isFinite(amount) && amount >= 0
  );
}

export default function StepFinance({ draft, setDraft, levels }: Props) {
  const form = useForm<FormValues>({
    defaultValues: { finance_catalogues: draft.finance_catalogues },
  });
  const watchedCatalogues = useWatch({
    control: form.control,
    name: "finance_catalogues",
  });
  const lastCataloguesRef = useRef(JSON.stringify(draft.finance_catalogues));
  const [activeClassIndex, setActiveClassIndex] = useState(0);
  const shouldCreateFinance = draft.finance_mode === "CREATION";
  const plannedClasses = useMemo(
    () => resolvePlannedClasses(draft.classes_by_level),
    [draft.classes_by_level],
  );
  const currentClass = plannedClasses[activeClassIndex] ?? null;
  const enteredCatalogueCount = draft.finance_catalogues.filter((catalogue) =>
    catalogue.nom.trim(),
  ).length;
  const completedCatalogueCount =
    draft.finance_catalogues.filter(isCatalogueComplete).length;
  const classCreationRequired =
    plannedClasses.length > 0 && draft.classes_mode !== "CREATION";

  useEffect(() => {
    if (activeClassIndex <= Math.max(plannedClasses.length - 1, 0)) return;
    setActiveClassIndex(Math.max(plannedClasses.length - 1, 0));
  }, [activeClassIndex, plannedClasses.length]);

  useEffect(() => {
    const nextKey = JSON.stringify(draft.finance_catalogues);

    if (nextKey === lastCataloguesRef.current) return;

    lastCataloguesRef.current = nextKey;
    form.reset({ finance_catalogues: draft.finance_catalogues });
  }, [draft.finance_catalogues, form]);

  useEffect(() => {
    const nextCatalogues = watchedCatalogues ?? [];
    const nextKey = JSON.stringify(nextCatalogues);

    if (nextKey === lastCataloguesRef.current) return;

    lastCataloguesRef.current = nextKey;
    setDraft((current) => ({
      ...current,
      finance_catalogues: nextCatalogues,
    }));
  }, [setDraft, watchedCatalogues]);

  
const currentClassEntries = useMemo(() => {
  if (!currentClass) return [];

  return draft.finance_catalogues
    .map((catalogue, index) => ({ catalogue, index }))
    .filter(
      ({ catalogue }) =>
        catalogue.level_code === currentClass.level_code &&
        catalogue.class_name === currentClass.class_name
    );
}, [
  draft.finance_catalogues,
  currentClass
]);

  const [enableNext, setEnableNext] = useState(
  currentClassEntries.every(({ catalogue }) => typeof catalogue.montant === "number")
);

useEffect(() => {
  setEnableNext(
    currentClassEntries.every(({ catalogue }) => typeof catalogue.montant === "number")
  );
}, [currentClassEntries]);

  const globalEntries = draft.finance_catalogues
    .map((catalogue, index) => ({ catalogue, index }))
    .filter(({ catalogue }) => !catalogue.class_name);

  const classCompletionByKey = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();

    plannedClasses.forEach((plannedClass) => {
      const entries = draft.finance_catalogues.filter(
        (catalogue) =>
          catalogue.level_code === plannedClass.level_code &&
          catalogue.class_name === plannedClass.class_name,
      );
      map.set(plannedClass.key, {
        total: entries.length,
        completed: entries.filter(isCatalogueComplete).length,
      });
    });

    return map;
  }, [draft.finance_catalogues, plannedClasses]);

  const removeCatalogue = (index: number) => {
    setDraft((current) => ({
      ...current,
      finance_catalogues: current.finance_catalogues.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  };

  const addCatalogueForCurrentClass = (usageScope = "SCOLARITE") => {
    if (!currentClass) return;

    setDraft((current) => ({
      ...current,
      finance_catalogues: [
        ...current.finance_catalogues,
        buildEmptyCatalogue(
          currentClass.level_code,
          currentClass.class_name,
          usageScope,
        ),
      ],
    }));
  };

  const addGlobalCatalogue = () => {
    setDraft((current) => ({
      ...current,
      finance_catalogues: [
        ...current.finance_catalogues,
        buildEmptyCatalogue("", "", "GENERAL"),
      ],
    }));
  };

  const prepareAllClasses = () => {
    setDraft((current) => {
      const classes = resolvePlannedClasses(current.classes_by_level);
      const missing = buildMissingClassCatalogues(
        classes,
        current.finance_catalogues,
      );

      return {
        ...current,
        finance_catalogues: [...current.finance_catalogues, ...missing],
      };
    });
  };

  const goToPreviousClass = () => {
    setActiveClassIndex((current) => Math.max(0, current - 1));
  };

  const goToNextClass = () => {
    setActiveClassIndex((current) =>
      Math.min(plannedClasses.length - 1, current + 1),
    );
  };

  const renderCatalogueFields = (
    catalogue: InitialisationFinanceCatalogueDraft,
    index: number,
  ) => (
    <article
      key={`finance-catalogue-${index}`}
      className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <FiDollarSign />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {catalogue.class_name || "Frais global"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {catalogue.level_code
                ? `Niveau ${levels.find((level) => level.code === catalogue.level_code)?.nom ?? catalogue.level_code}`
                : "Applicable sans restriction de niveau"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => removeCatalogue(index)}
          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          <FiTrash2 />
          Supprimer
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SelectField<FormValues, string>
          control={form.control}
          name={`finance_catalogues.${index}.usage_scope` as Path<FormValues>}
          label="Usage"
          options={usageScopeOptions}
          emptyLabel="Choisir un usage"
        />

        <TextField<FormValues>
          control={form.control}
          name={`finance_catalogues.${index}.nom` as Path<FormValues>}
          label="Nom du frais"
          placeholder="Ex: Frais de scolarite"
          className="md:col-span-2"
        />

        <FloatField<FormValues>
          control={form.control}
          name={`finance_catalogues.${index}.montant` as Path<FormValues>}
          label="Montant"
          placeholder="150000"
          required
        />

        <SelectField<FormValues, string>
          control={form.control}
          name={`finance_catalogues.${index}.devise` as Path<FormValues>}
          label="Devise"
          options={deviseOptions.map((devise) => ({
            value: devise,
            label: devise,
          }))}
          emptyLabel="Choisir une devise"
        />

        <IntField<FormValues>
          control={form.control}
          name={
            `finance_catalogues.${index}.nombre_tranches` as Path<FormValues>
          }
          label="Tranches"
          placeholder="1"
        />

        <BooleanField<FormValues>
          control={form.control}
          name={`finance_catalogues.${index}.est_recurrent` as Path<FormValues>}
          label="Recurrent"
        />

        {catalogue.est_recurrent ? (
          <>
            <SelectField<FormValues, string>
              control={form.control}
              name={
                `finance_catalogues.${index}.periodicite` as Path<FormValues>
              }
              label="Periodicite"
              options={periodiciteOptions}
              emptyLabel="Choisir une periodicite"
            />

            <BooleanField<FormValues>
              control={form.control}
              name={
                `finance_catalogues.${index}.prorata_eligible` as Path<FormValues>
              }
              label="Prorata mensuel"
              disabled={catalogue.periodicite !== "monthly"}
            />
          </>
        ) : null}
      </div>

      <div className="mt-3">
        <TextAreaField<FormValues>
          control={form.control}
          name={`finance_catalogues.${index}.description` as Path<FormValues>}
          label="Description"
          placeholder="Note courte visible dans le catalogue"
        />
      </div>
    </article>
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ecfeff_0%,#fff7ed_100%)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                Finance
              </span>
              <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                Wizard par classe
              </span>
            </div>
            <h4 className="mt-4 text-lg font-semibold text-slate-900">
              Catalogues de frais par classe
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Le wizard reprend les classes choisies precedemment, prepare les
              frais classiques, puis te laisse completer les montants classe par
              classe.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] border border-white/80 bg-white/85 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Frais crees
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {enteredCatalogueCount}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/80 bg-white/85 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Complets
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {completedCatalogueCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      <BlockActionSelector
        value={draft.finance_mode}
        onChange={(value) =>
          setDraft((current) => {
            const classes = resolvePlannedClasses(current.classes_by_level);
            const missing =
              value === "CREATION" && current.finance_catalogues.length === 0
                ? buildMissingClassCatalogues(
                    classes,
                    current.finance_catalogues,
                  )
                : [];

            return {
              ...current,
              finance_mode: value,
              finance_catalogues: [...current.finance_catalogues, ...missing],
            };
          })
        }
      />

      {!shouldCreateFinance ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-6 text-slate-600">
          Le catalogue financier est reporte. Les frais pourront etre crees plus
          tard depuis le module Finance, sans bloquer le reste de
          l'initialisation.
        </div>
      ) : plannedClasses.length === 0 ? (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm leading-6 text-amber-800">
            Aucune classe n'est encore disponible dans l'etape Classes. Tu peux
            creer un frais global maintenant, ou revenir completer les classes
            pour activer le wizard automatique par classe.
          </div>
          <button
            type="button"
            onClick={addGlobalCatalogue}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <FiPlus />
            Ajouter un frais global
          </button>
          {globalEntries.map(({ catalogue, index }) =>
            renderCatalogueFields(catalogue, index),
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {classCreationRequired ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm leading-6 text-amber-800">
              Les frais par classe necessitent que le bloc Classes soit en mode
              Creation, afin que les classes existent au moment de generer les
              catalogues.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {currentClass
                  ? `${currentClass.class_name} - ${currentClass.level_nom}`
                  : "Classe"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Classe {activeClassIndex + 1} sur {plannedClasses.length}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={prepareAllClasses}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <FiCreditCard />
                Preparer toutes les classes
              </button>
              <button
                type="button"
                onClick={addGlobalCatalogue}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <FiPlus />
                Frais global
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="rounded-[26px] border border-slate-200 bg-white p-3 shadow-sm">
              <div className="space-y-2">
                {plannedClasses.map((plannedClass, index) => {
                  const active = index === activeClassIndex;
                  const progress = classCompletionByKey.get(
                    plannedClass.key,
                  ) ?? {
                    total: 0,
                    completed: 0,
                  };

                  return (
                    <button
                      key={plannedClass.key}
                      type="button"
                      onClick={() => setActiveClassIndex(index)}
                      className={`w-full rounded-[20px] border px-3 py-3 text-left transition ${
                        active
                          ? "border-cyan-300 bg-cyan-50"
                          : "border-transparent bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {plannedClass.class_name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {plannedClass.level_nom}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                            progress.total > 0 &&
                            progress.completed === progress.total
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {progress.completed}/{progress.total}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="min-w-0 space-y-4">
              <div className="sticky top-0 z-30 rounded-[26px] border border-slate-200/80 bg-white/95 p-3 shadow-lg shadow-slate-200/60 backdrop-blur sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addCatalogueForCurrentClass("INSCRIPTION")}
                      className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
                    >
                      <FiPlus />
                      Inscription
                    </button>
                    <button
                      type="button"
                      onClick={() => addCatalogueForCurrentClass("SCOLARITE")}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <FiPlus />
                      Scolarite
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={goToPreviousClass}
                      disabled={activeClassIndex === 0}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <FiArrowLeft />
                      Precedent
                    </button>
                    <button
                      type="button"
                      onClick={goToNextClass}
                      title={!enableNext ? "Completer les frais de la classe avant de continuer" : "Passer à la classe suivante"}
                      disabled={activeClassIndex >= plannedClasses.length - 1 || !enableNext}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      
                      Suivant
                      <FiArrowRight />
                    </button>
                  </div>
                </div>
              </div>

              {currentClassEntries.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-cyan-300 bg-cyan-50/70 px-5 py-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm">
                    <FiCreditCard />
                  </div>
                  <h5 className="mt-4 text-base font-semibold text-slate-900">
                    Aucun frais pour cette classe
                  </h5>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                    Ajoute un frais d'inscription ou de scolarite, ou utilise
                    "Preparer toutes les classes" pour gagner du temps.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentClassEntries.map(({ catalogue, index }) =>
                    renderCatalogueFields(catalogue, index),
                  )}
                </div>
              )}

              {globalEntries.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FiCheckCircle className="text-emerald-600" />
                    Frais globaux
                  </div>
                  {globalEntries.map(({ catalogue, index }) =>
                    renderCatalogueFields(catalogue, index),
                  )}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
