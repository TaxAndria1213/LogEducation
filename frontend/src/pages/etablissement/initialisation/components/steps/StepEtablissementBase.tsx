import type { Dispatch, SetStateAction } from "react";
import type { InitialisationSetupDraft } from "../../types";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
};

export default function StepEtablissementBase({ draft, setDraft }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
        <p className="text-sm text-slate-600">
          Cette premiere etape pose le socle d'exploitation: site principal et coordonnees
          visibles des equipes.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4">
        <input
          type="checkbox"
          checked={draft.include_site_principal}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              include_site_principal: event.target.checked,
            }))
          }
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            Creer ou verifier le site principal
          </span>
          <span className="mt-1 block text-sm text-slate-600">
            Le commit cree un site uniquement s'il n'existe pas deja sous ce nom.
          </span>
        </span>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Nom du site</span>
          <input
            value={draft.site_principal_nom}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                site_principal_nom: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            placeholder="Site principal"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">Telephone</span>
          <input
            value={draft.site_principal_telephone}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                site_principal_telephone: event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            placeholder="+261 ..."
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">Adresse</span>
        <textarea
          value={draft.site_principal_adresse}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              site_principal_adresse: event.target.value,
            }))
          }
          className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          placeholder="Adresse du campus principal"
        />
      </label>
    </div>
  );
}
