import type { Dispatch, SetStateAction } from "react";
import type { InitialisationSetupDraft } from "../../types";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
};

export default function StepAnneeInitiale({ draft, setDraft }: Props) {
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4">
        <input
          type="checkbox"
          checked={draft.create_initial_year}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              create_initial_year: event.target.checked,
            }))
          }
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            Creer l'annee scolaire initiale
          </span>
          <span className="mt-1 block text-sm text-slate-600">
            Le module cree une annee active, puis l'utilise comme point d'appui des autres
            modules.
          </span>
        </span>
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Libelle</span>
          <input
            value={draft.annee_nom}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                annee_nom: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            placeholder="2026-2027"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Date debut</span>
          <input
            type="date"
            value={draft.annee_date_debut}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                annee_date_debut: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Date fin</span>
          <input
            type="date"
            value={draft.annee_date_fin}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                annee_date_fin: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
        </label>
      </div>
    </div>
  );
}
