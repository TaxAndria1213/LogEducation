import type { Dispatch, SetStateAction } from "react";
import { FiCheckCircle, FiShield } from "react-icons/fi";
import type { InitialisationSetupDraft, InitialisationTemplates } from "../../types";
import BlockActionSelector from "../shared/BlockActionSelector";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
  templates: InitialisationTemplates | null;
};

export default function StepSecurite({ draft, setDraft, templates }: Props) {
  const roles = templates?.roles_standards ?? [];
  const selectedCount = draft.selected_role_names.length;
  const shouldCreateSecurity = draft.security_mode === "CREATION";

  const toggleRole = (roleName: string) => {
    setDraft((current) => {
      const exists = current.selected_role_names.includes(roleName);
      return {
        ...current,
        selected_role_names: exists
          ? current.selected_role_names.filter((entry) => entry !== roleName)
          : [...current.selected_role_names, roleName],
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Roles standards suggeres
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              On te propose ici les roles classiques d&apos;un etablissement. Ils sont
              ajustables librement, avec Direction, Secretariat et Enseignant
              preselectionnes pour accelerer le demarrage.
            </p>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 shadow-sm">
            {selectedCount} selectionne{selectedCount > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <BlockActionSelector
        value={draft.security_mode}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            security_mode: value,
          }))
        }
      />

      {shouldCreateSecurity ? (
        roles.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {roles.map((role) => {
              const checked = draft.selected_role_names.includes(role.nom);

              return (
                <button
                  key={role.nom}
                  type="button"
                  onClick={() => toggleRole(role.nom)}
                  className={`rounded-[22px] border px-4 py-4 text-left transition ${
                    checked
                      ? "border-cyan-300 bg-cyan-50 shadow-sm shadow-cyan-100/70"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          checked
                            ? "bg-white text-cyan-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {checked ? <FiCheckCircle /> : <FiShield />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {role.label}
                          </p>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {role.key}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {role.description}
                        </p>
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                          {role.permissions.length} permission
                          {role.permissions.length > 1 ? "s" : ""} modele
                        </p>
                      </div>
                    </div>

                    <span
                      className={`mt-1 h-5 w-5 shrink-0 rounded-md border transition ${
                        checked
                          ? "border-cyan-500 bg-cyan-500"
                          : "border-slate-300 bg-white"
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            Les roles standards sont en cours de chargement ou indisponibles pour le moment.
          </div>
        )
      ) : (
        <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          Les roles standards ne seront pas generes maintenant. La configuration de
          securite pourra etre reprise plus tard sans bloquer l'initialisation.
        </div>
      )}
    </div>
  );
}
