import type { Dispatch, SetStateAction } from "react";
import { FiGrid, FiLayers, FiPlus, FiTrash2 } from "react-icons/fi";
import type { InitialisationSetupDraft } from "../../types";
import BlockActionSelector from "../shared/BlockActionSelector";
import type { DraftLevelDefinition } from "../../utils/levels";
import { buildSuggestedClassName, countEnteredClasses } from "../../utils/levels";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
  levels: DraftLevelDefinition[];
};

export default function StepClasses({ draft, setDraft, levels }: Props) {
  const classCount = countEnteredClasses(draft.classes_by_level);
  const groupsByCode = new Map(
    draft.classes_by_level.map((group) => [group.level_code, group] as const),
  );

  const updateClassNames = (
    level: DraftLevelDefinition,
    updater: (currentNames: string[]) => string[],
  ) => {
    setDraft((current) => ({
      ...current,
      classes_by_level: current.classes_by_level.map((group) =>
        group.level_code === level.code
          ? {
              ...group,
              level_nom: level.nom,
              class_names: updater(group.class_names),
            }
          : group,
      ),
    }));
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_100%)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                Classes
              </span>
              <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                {levels.length} niveau(x)
              </span>
            </div>
            <h4 className="mt-4 text-lg font-semibold text-slate-900">
              Structure des classes apres les niveaux
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Chaque niveau retenu peut maintenant recevoir une ou plusieurs classes.
              Une premiere proposition est pre-remplie, puis tu ajustes librement la
              liste niveau par niveau.
            </p>
          </div>

          <div className="rounded-[22px] border border-white/80 bg-white/85 px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Classes renseignees
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{classCount}</p>
          </div>
        </div>
      </section>

      <BlockActionSelector
        value={draft.classes_mode}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            classes_mode: value,
          }))
        }
      />

      {draft.classes_mode === "PLUS_TARD" ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-6 text-slate-600">
          Les classes restent differees pour l'instant. Tu pourras y revenir plus tard
          sans perdre les niveaux deja prepares.
        </div>
      ) : levels.length === 0 ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm leading-6 text-amber-800">
          Selectionne d'abord au moins un niveau dans l'etape precedente pour ouvrir la
          saisie des classes.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {levels.map((level) => {
            const group = groupsByCode.get(level.code) ?? {
              level_code: level.code,
              level_nom: level.nom,
              class_names: [],
            };
            const enteredCount = group.class_names.filter((className) => className.trim()).length;

            return (
              <article
                key={level.code}
                className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        {level.code}
                      </span>
                      <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-700">
                        {enteredCount} classe(s)
                      </span>
                    </div>
                    <h5 className="mt-3 text-base font-semibold text-slate-900">{level.nom}</h5>
                    <p className="mt-1 text-sm text-slate-500">
                      Renseigne ici toutes les classes de ce niveau pour l'annee de depart.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateClassNames(level, (currentNames) => [
                        ...currentNames,
                        buildSuggestedClassName(level, currentNames.length),
                      ])
                    }
                    className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <FiPlus />
                    Ajouter
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {group.class_names.map((className, index) => (
                    <div
                      key={`${level.code}-${index}`}
                      className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Nom de la classe
                        </label>
                        <input
                          value={className}
                          onChange={(event) =>
                            updateClassNames(level, (currentNames) =>
                              currentNames.map((entry, entryIndex) =>
                                entryIndex === index ? event.target.value : entry,
                              ),
                            )
                          }
                          placeholder={buildSuggestedClassName(level, index)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                        />
                      </div>
                      {group.class_names.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateClassNames(level, (currentNames) =>
                              currentNames.filter((_, entryIndex) => entryIndex !== index),
                            )
                          }
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                          aria-label={`Supprimer la classe ${index + 1} du niveau ${level.nom}`}
                        >
                          <FiTrash2 />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <FiGrid />
                  <span>
                    Exemple rapide : {buildSuggestedClassName(level, 0)}, {buildSuggestedClassName(level, 1)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {draft.classes_mode !== "PLUS_TARD" && levels.length > 0 ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-slate-500">
              <FiLayers />
            </div>
            <p className="leading-6">
              Les classes seront creees dans l'annee scolaire initiale si elle est generee
              maintenant, sinon sur l'annee active deja existante.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
