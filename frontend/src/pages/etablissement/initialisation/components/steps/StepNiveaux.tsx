import type { Dispatch, SetStateAction } from "react";
import type { InitialisationSetupDraft, InitialisationTemplates } from "../../types";
import TemplateChoiceCard from "../shared/TemplateChoiceCard";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
  templates: InitialisationTemplates | null;
};

export default function StepNiveaux({ draft, setDraft, templates }: Props) {
  const levels = templates?.niveaux_standards ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {levels.map((level) => {
          const selected = draft.selected_level_codes.includes(level.code);
          return (
            <TemplateChoiceCard
              key={level.code}
              label={level.nom}
              description={`${level.cycle} - ordre ${level.ordre}`}
              selected={selected}
              onToggle={() =>
                setDraft((current) => ({
                  ...current,
                  selected_level_codes: selected
                    ? current.selected_level_codes.filter((code) => code !== level.code)
                    : [...current.selected_level_codes, level.code],
                }))
              }
            />
          );
        })}
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">
          Niveaux personnalises
        </span>
        <textarea
          value={draft.custom_levels}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              custom_levels: event.target.value,
            }))
          }
          className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          placeholder={"Ex: CAP 1\nCAP 2"}
        />
      </label>
    </div>
  );
}
