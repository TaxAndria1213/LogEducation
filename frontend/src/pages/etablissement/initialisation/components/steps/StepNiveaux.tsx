import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FiCheckCircle, FiLayers } from "react-icons/fi";
import { TextAreaField } from "../../../../../components/Form/fields/TextAreaField";
import type {
  InitialisationSetupDraft,
  InitialisationTemplates,
} from "../../types";
import TemplateChoiceCard from "../shared/TemplateChoiceCard";
import {
  getCombinedPresetLevelNames,
  getPresetLevelCodes,
  LEVEL_SELECTION_PRESETS,
} from "../../utils/levels";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
  templates: InitialisationTemplates | null;
};

export default function StepNiveaux({ draft, setDraft, templates }: Props) {
  const form = useForm<{ custom_levels: string }>({
    defaultValues: { custom_levels: draft.custom_levels },
  });
  const watchedCustomLevels = useWatch({
    control: form.control,
    name: "custom_levels",
  });
  const lastCustomLevelsRef = useRef(draft.custom_levels);
  const levels = templates?.niveaux_standards ?? [];
  const selectedPresetLevelCodes = Array.from(
    new Set(
      draft.selected_level_presets.flatMap((preset) =>
        getPresetLevelCodes(templates, preset),
      ),
    ),
  );
  const selectedPresetLevelCodeSet = new Set(selectedPresetLevelCodes);
  const selectedPresetLevelNames = getCombinedPresetLevelNames(
    templates,
    draft.selected_level_presets,
  );
  const availableManualLevels = levels.filter(
    (level) => !selectedPresetLevelCodeSet.has(level.code),
  );

  const togglePreset = (
    presetKey: (typeof LEVEL_SELECTION_PRESETS)[number]["key"],
  ) => {
    const presetCodes = getPresetLevelCodes(templates, presetKey);

    setDraft((current) => {
      const alreadySelected =
        current.selected_level_presets.includes(presetKey);
      return {
        ...current,
        selected_level_presets: alreadySelected
          ? current.selected_level_presets.filter(
              (preset) => preset !== presetKey,
            )
          : [...current.selected_level_presets, presetKey],
        manual_selected_level_codes: alreadySelected
          ? current.manual_selected_level_codes
          : current.manual_selected_level_codes.filter(
              (code) => !presetCodes.includes(code),
            ),
      };
    });
  };

  const toggleManualLevel = (levelCode: string) => {
    setDraft((current) => {
      const selected = current.manual_selected_level_codes.includes(levelCode);
      return {
        ...current,
        manual_selected_level_codes: selected
          ? current.manual_selected_level_codes.filter(
              (code) => code !== levelCode,
            )
          : [...current.manual_selected_level_codes, levelCode],
      };
    });
  };

  useEffect(() => {
    if (draft.custom_levels === lastCustomLevelsRef.current) return;

    lastCustomLevelsRef.current = draft.custom_levels;
    form.reset({ custom_levels: draft.custom_levels });
  }, [draft.custom_levels, form]);

  useEffect(() => {
    const nextValue = watchedCustomLevels ?? "";

    if (nextValue === lastCustomLevelsRef.current) return;

    lastCustomLevelsRef.current = nextValue;
    setDraft((current) => ({
      ...current,
      custom_levels: nextValue,
    }));
  }, [setDraft, watchedCustomLevels]);

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_100%)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              <FiLayers className="text-cyan-700" />
              Point de depart
            </div>
            <h4 className="mt-3 text-lg font-semibold text-slate-900">
              Combine un ou plusieurs groupes de niveaux
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              On peut partir d&apos;un seul cycle ou combiner plusieurs groupes
              pour aller vite sur un etablissement mixte. Ensuite, on affine
              juste en dessous si certains niveaux doivent etre ajoutes a la
              main.
            </p>
          </div>

          <div className="rounded-[20px] border border-cyan-100 bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Groupes actifs
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {draft.selected_level_presets.length} groupe(s)
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {LEVEL_SELECTION_PRESETS.map((preset) => {
            const selected = draft.selected_level_presets.includes(preset.key);
            const presetLevelNames = getPresetLevelCodes(templates, preset.key)
              .length
              ? getCombinedPresetLevelNames(templates, [preset.key])
              : [];
            const description =
              presetLevelNames.length > 0
                ? `${presetLevelNames.length} niveaux standards - ${presetLevelNames.join(", ")}`
                : preset.description;

            return (
              <TemplateChoiceCard
                key={preset.key}
                label={preset.label}
                description={description}
                selected={selected}
                onToggle={() => togglePreset(preset.key)}
              />
            );
          })}
        </div>
      </section>

      <section className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              <FiCheckCircle />
              Selection rapide cumulee
            </div>
            <h4 className="mt-3 text-base font-semibold text-slate-900">
              Groupes retenus pour le demarrage
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Les niveaux ci-dessous seront repris automatiquement pour
              preconfigurer les classes et le socle academique. Si tu veux un
              groupe partiel, retire le groupe concerne puis ajoute uniquement
              les niveaux utiles dans la zone personnalisee.
            </p>
          </div>

          <div className="rounded-[18px] border border-emerald-200 bg-white px-3 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Niveaux via groupes
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {selectedPresetLevelNames.length}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {draft.selected_level_presets.length > 0 ? (
            selectedPresetLevelNames.map((name) => (
              <span
                key={name}
                className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700"
              >
                {name}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700">
              Aucun groupe rapide selectionne pour le moment.
            </span>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h4 className="text-base font-semibold text-slate-900">
              Choix personnalise des niveaux standards
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Cette zone sert a completer les groupes rapides avec d&apos;autres
              niveaux standards. Les niveaux deja inclus par les groupes actifs
              sont resumes au-dessus et n&apos;ont pas besoin d&apos;etre
              recoches ici.
            </p>
          </div>

          <div className="rounded-[18px] bg-slate-50 px-3 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Ajouts manuels
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {draft.manual_selected_level_codes.length} niveau(x)
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {availableManualLevels.length > 0 ? (
            availableManualLevels.map((level) => {
              const selected = draft.manual_selected_level_codes.includes(
                level.code,
              );
              return (
                <TemplateChoiceCard
                  key={level.code}
                  label={level.nom}
                  description={`${level.cycle} - ordre ${level.ordre}`}
                  selected={selected}
                  onToggle={() => toggleManualLevel(level.code)}
                />
              );
            })
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-600 md:col-span-2 xl:col-span-3">
              Tous les niveaux standards sont deja couverts par les groupes
              rapides actifs. Si tu veux une selection plus fine, retire un
              groupe puis choisis seulement les niveaux utiles ici.
            </div>
          )}
        </div>
      </section>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
        <TextAreaField<{ custom_levels: string }>
          control={form.control}
          name="custom_levels"
          label="Niveaux personnalises"
          description="Ajoute ici des niveaux qui ne font pas partie du socle standard. Un nom par ligne, ou plusieurs noms separes par des virgules."
          placeholder={"Ex: CAP 1\nCAP 2"}
        />
      </div>
    </div>
  );
}
