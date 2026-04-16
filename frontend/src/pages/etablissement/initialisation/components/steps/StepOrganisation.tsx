import type { Dispatch, SetStateAction } from "react";
import type { InitialisationSetupDraft, InitialisationTemplates } from "../../types";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
  templates: InitialisationTemplates | null;
};

export default function StepOrganisation({ draft, setDraft, templates }: Props) {
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4">
        <input
          type="checkbox"
          checked={draft.create_default_departements}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              create_default_departements: event.target.checked,
            }))
          }
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            Creer les departements standards
          </span>
          <span className="mt-1 block text-sm text-slate-600">
            Direction, scolarite, finance, pedagogie, vie scolaire, cantine, transport et
            bibliotheque.
          </span>
        </span>
      </label>

      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-sm font-semibold text-slate-900">Departements proposes</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(templates?.departements_standards ?? []).map((entry) => (
            <span
              key={entry}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {entry}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
