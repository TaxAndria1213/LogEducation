import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import {
  FiCalendar,
  FiEdit3,
  FiLayers,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { BooleanField } from "../../../../../components/Form/fields/BooleanField";
import { TextField } from "../../../../../components/Form/fields/TextField";
import type {
  InitialisationSetupDraft,
  InitialisationTemplates,
} from "../../types";
import TemplateChoiceCard from "../shared/TemplateChoiceCard";
import {
  arePeriodsEqual,
  buildEmptyCustomPeriod,
  buildPeriodsFromTemplate,
  getSelectedPeriodTemplate,
  resolveDraftPeriods,
  syncPeriodsWithTemplateBoundaries,
} from "../../utils/periods";
import InitialisationDateInput from "../shared/InitialisationDateInput";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
  templates: InitialisationTemplates | null;
};

type FormValues = Pick<
  InitialisationSetupDraft,
  "create_initial_year" | "annee_nom" | "custom_periods"
>;

type WatchedFormValues = {
  create_initial_year?: boolean;
  annee_nom?: string;
  custom_periods?: {
    nom?: string;
    date_debut?: string;
    date_fin?: string;
  }[];
};

function getValuesFromDraft(draft: InitialisationSetupDraft): FormValues {
  return {
    create_initial_year: draft.create_initial_year,
    annee_nom: draft.annee_nom,
    custom_periods: draft.custom_periods,
  };
}

function normalizeFormValues(
  draft: InitialisationSetupDraft,
  values: WatchedFormValues,
): FormValues {
  return {
    create_initial_year:
      values.create_initial_year ?? draft.create_initial_year,
    annee_nom: values.annee_nom ?? draft.annee_nom,
    custom_periods: (values.custom_periods ?? draft.custom_periods).map(
      (period) => ({
        nom: period?.nom ?? "",
        date_debut: period?.date_debut ?? "",
        date_fin: period?.date_fin ?? "",
      }),
    ),
  };
}

export default function StepAnneeInitiale({
  draft,
  setDraft,
  templates,
}: Props) {
  const form = useForm<FormValues>({
    defaultValues: getValuesFromDraft(draft),
  });
  const watchedValues = useWatch({ control: form.control });
  const lastSyncRef = useRef(JSON.stringify(getValuesFromDraft(draft)));
  const selectedPeriodTemplate = getSelectedPeriodTemplate(
    templates,
    draft.periods_template_code,
  );
  const resolvedPeriods = resolveDraftPeriods(draft, templates);
  const displayedPeriods =
    draft.custom_periods.length > 0 ? draft.custom_periods : resolvedPeriods;

  useEffect(() => {
    const nextValues = getValuesFromDraft(draft);
    const nextKey = JSON.stringify(nextValues);

    if (nextKey === lastSyncRef.current) return;

    lastSyncRef.current = nextKey;
    form.reset(nextValues);
  }, [draft, form]);

  useEffect(() => {
    const nextValues = normalizeFormValues(draft, watchedValues);
    const nextKey = JSON.stringify(nextValues);

    if (nextKey === lastSyncRef.current) return;

    lastSyncRef.current = nextKey;
    setDraft((current) => ({
      ...current,
      ...nextValues,
    }));
  }, [draft, setDraft, watchedValues]);

  useEffect(() => {
    if (draft.periods_strategy !== "STANDARD") return;

    setDraft((current) => {
      if (current.periods_strategy !== "STANDARD") return current;
      const nextPeriods = syncPeriodsWithTemplateBoundaries(
        templates,
        current.periods_template_code,
        current.annee_date_debut,
        current.annee_date_fin,
        current.custom_periods,
      );

      if (arePeriodsEqual(current.custom_periods, nextPeriods)) return current;

      return {
        ...current,
        custom_periods: nextPeriods,
      };
    });
  }, [
    draft.annee_date_debut,
    draft.annee_date_fin,
    draft.periods_strategy,
    draft.periods_template_code,
    setDraft,
    templates,
  ]);

  const selectPeriodTemplate = (templateCode: string) => {
    const nextPeriods = buildPeriodsFromTemplate(
      templates,
      templateCode,
      draft.annee_date_debut,
      draft.annee_date_fin,
    );

    setDraft((current) => ({
      ...current,
      periods_strategy: "STANDARD",
      periods_template_code: templateCode,
      custom_periods: nextPeriods,
    }));
  };

  const switchToCustomPeriods = () => {
    setDraft((current) => ({
      ...current,
      periods_strategy: "PERSONNALISE",
      custom_periods:
        current.custom_periods.length > 0
          ? current.custom_periods
          : [buildEmptyCustomPeriod()],
    }));
  };

  const updateCustomPeriod = (
    index: number,
    field: "nom" | "date_debut" | "date_fin",
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      custom_periods: current.custom_periods.map((periode, periodeIndex) =>
        periodeIndex === index
          ? {
              ...periode,
              [field]: value,
            }
          : periode,
      ),
    }));
  };

  const updateConfiguredPeriod = (
    index: number,
    field: "nom" | "date_debut" | "date_fin",
    value: string,
  ) => {
    setDraft((current) => {
      const sourcePeriods =
        current.custom_periods.length > 0
          ? current.custom_periods
          : buildPeriodsFromTemplate(
              templates,
              current.periods_template_code,
              current.annee_date_debut,
              current.annee_date_fin,
            );

      return {
        ...current,
        custom_periods: sourcePeriods.map((periode, periodeIndex) =>
          periodeIndex === index
            ? {
                ...periode,
                [field]: value,
              }
            : periode,
        ),
      };
    });
  };

  const addCustomPeriod = () => {
    setDraft((current) => ({
      ...current,
      periods_strategy: "PERSONNALISE",
      custom_periods: [...current.custom_periods, buildEmptyCustomPeriod()],
    }));
  };

  const removeCustomPeriod = (index: number) => {
    setDraft((current) => ({
      ...current,
      custom_periods: current.custom_periods.filter(
        (_, periodeIndex) => periodeIndex !== index,
      ),
    }));
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_100%)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
              <FiCalendar className="text-cyan-700" />
              Cadre temporel
            </div>
            <h4 className="mt-4 text-lg font-semibold text-slate-900">
              Premiere annee scolaire et periodes de depart
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              On pose ici l'annee initiale de l'etablissement, puis on choisit
              soit un decoupage standard tres rapide, soit des periodes
              entierement personnalisees.
            </p>
          </div>

          <div className="rounded-[22px] border border-white/80 bg-white/85 px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Periodes prevues
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {resolvedPeriods.length}
            </p>
          </div>
        </div>
      </section>

      <BooleanField<FormValues>
        control={form.control}
        name="create_initial_year"
        label="Creer l'annee scolaire initiale"
        description="Le module cree une annee active, puis s'appuie dessus pour les periodes, les classes et le reste de l'initialisation."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <TextField<FormValues>
          control={form.control}
          name="annee_nom"
          label="Libelle"
          placeholder="2026-2027"
        />

        <InitialisationDateInput
          id="initialisation-annee-date-debut"
          label="Date debut"
          value={draft.annee_date_debut}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              annee_date_debut: value,
            }))
          }
        />

        <InitialisationDateInput
          id="initialisation-annee-date-fin"
          label="Date fin"
          value={draft.annee_date_fin}
          min={draft.annee_date_debut}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              annee_date_fin: value,
            }))
          }
        />
      </div>

      {!draft.create_initial_year ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-6 text-slate-600">
          Les periodes resteront en attente tant que l'annee initiale n'est pas
          creee dans ce wizard.
        </div>
      ) : (
        <>
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  <FiLayers />
                  Periodes
                </div>
                <h4 className="mt-3 text-base font-semibold text-slate-900">
                  Choisis un modele standard ou personnalise ton decoupage
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Les modeles standards sont ideaux pour aller vite. Le mode
                  personnalise te laisse definir toi-meme les libelles et les
                  dates de chaque periode.
                </p>
              </div>

              <div className="rounded-[18px] bg-slate-50 px-3 py-2 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Mode actif
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {draft.periods_strategy === "PERSONNALISE"
                    ? "Personnalise"
                    : (selectedPeriodTemplate?.label ?? "Standard")}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(templates?.periodes_standards ?? []).map((template) => (
                <TemplateChoiceCard
                  key={template.code}
                  label={template.label}
                  description={`${template.periodes.length} periode(s) - ${template.periodes.map((periode) => periode.nom).join(", ")}`}
                  selected={
                    draft.periods_strategy === "STANDARD" &&
                    draft.periods_template_code === template.code
                  }
                  onToggle={() => selectPeriodTemplate(template.code)}
                />
              ))}

              <TemplateChoiceCard
                label="Personnaliser"
                description="Saisis toi-meme les libelles et les dates exactes de chaque periode."
                selected={draft.periods_strategy === "PERSONNALISE"}
                onToggle={switchToCustomPeriods}
              />
            </div>
          </section>

          {draft.periods_strategy === "PERSONNALISE" ? (
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                    <FiEdit3 />
                    Personnalisation
                  </div>
                  <h4 className="mt-3 text-base font-semibold text-slate-900">
                    Definis les periodes de ton etablissement
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Ajoute autant de periodes que necessaire. Elles doivent
                    toutes rester comprises dans l'annee scolaire choisie juste
                    au-dessus.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addCustomPeriod}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <FiPlus />
                  Ajouter
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {draft.custom_periods.map((periode, index) => (
                  <div
                    key={`custom-period-${index}`}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Periode {index + 1}
                          </p>
                          <p className="text-xs text-slate-500">
                            Libelle et bornes de la periode
                          </p>
                        </div>
                      </div>

                      {draft.custom_periods.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeCustomPeriod(index)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                          aria-label={`Supprimer la periode ${index + 1}`}
                        >
                          <FiTrash2 />
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <TextField<FormValues>
                        control={form.control}
                        name={`custom_periods.${index}.nom` as Path<FormValues>}
                        label="Nom"
                        placeholder={`Periode ${index + 1}`}
                      />

                      <InitialisationDateInput
                        id={`custom-period-${index}-start`}
                        label="Date debut"
                        value={periode.date_debut}
                        min={draft.annee_date_debut}
                        max={draft.annee_date_fin}
                        onChange={(value) =>
                          updateCustomPeriod(index, "date_debut", value)
                        }
                      />

                      <InitialisationDateInput
                        id={`custom-period-${index}-end`}
                        label="Date fin"
                        value={periode.date_fin}
                        min={periode.date_debut || draft.annee_date_debut}
                        max={draft.annee_date_fin}
                        onChange={(value) =>
                          updateCustomPeriod(index, "date_fin", value)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <h4 className="text-base font-semibold text-slate-900">
                    Dates des periodes du modele retenu
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Les dates sont reparties automatiquement sur toute l'annee
                    scolaire selon le nombre de periodes du modele choisi. Tu
                    peux toujours ajuster une borne manuellement si besoin.
                  </p>
                </div>

                <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-2 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Modele
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedPeriodTemplate?.label ?? "Aucun"}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {displayedPeriods.map((periode, index) => (
                  <div
                    key={`${periode.nom}-${index}`}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {periode.nom || `Periode ${index + 1}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Periode {index + 1} du modele{" "}
                          {selectedPeriodTemplate?.label}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Repartition auto
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <InitialisationDateInput
                        id={`standard-period-${index}-start`}
                        label="Date debut"
                        value={periode.date_debut}
                        min={draft.annee_date_debut}
                        max={draft.annee_date_fin}
                        onChange={(value) =>
                          updateConfiguredPeriod(index, "date_debut", value)
                        }
                      />
                      <InitialisationDateInput
                        id={`standard-period-${index}-end`}
                        label="Date fin"
                        value={periode.date_fin}
                        min={periode.date_debut || draft.annee_date_debut}
                        max={draft.annee_date_fin}
                        onChange={(value) =>
                          updateConfiguredPeriod(index, "date_fin", value)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
