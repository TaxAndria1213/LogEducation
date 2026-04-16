import type { Dispatch, SetStateAction } from "react";
import { FiBookOpen, FiClipboard, FiHash, FiPlus, FiTrash2 } from "react-icons/fi";
import type { InitialisationSetupDraft } from "../../types";
import BlockActionSelector from "../shared/BlockActionSelector";
import type { DraftLevelDefinition } from "../../utils/levels";
import {
  buildEmptyAcademicSubject,
  buildSuggestedProgrammeName,
  countEnteredAcademicSubjects,
} from "../../utils/academics";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
  levels: DraftLevelDefinition[];
};

export default function StepAcademique({ draft, setDraft, levels }: Props) {
  const subjectCount = countEnteredAcademicSubjects(draft.academic_by_level);
  const groupsByCode = new Map(
    draft.academic_by_level.map((group) => [group.level_code, group] as const),
  );

  const updateGroup = (
    level: DraftLevelDefinition,
    updater: (
      currentGroup: {
        level_code: string;
        level_nom: string;
        programme_nom: string;
        subjects: {
          nom: string;
          code: string;
          heures_semaine: string;
          coefficient: string;
        }[];
      },
    ) => {
      level_code: string;
      level_nom: string;
      programme_nom: string;
      subjects: {
        nom: string;
        code: string;
        heures_semaine: string;
        coefficient: string;
      }[];
    },
  ) => {
    setDraft((current) => ({
      ...current,
      academic_by_level: current.academic_by_level.map((group) =>
        group.level_code === level.code
          ? updater(group)
          : group,
      ),
    }));
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fffaf0_0%,#eff6ff_100%)] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                Academique
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                {levels.length} niveau(x)
              </span>
            </div>
            <h4 className="mt-4 text-lg font-semibold text-slate-900">
              Programmes et matieres par niveau
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Chaque niveau peut maintenant recevoir son programme de depart avec une ou
              plusieurs matieres, leurs codes, leurs volumes horaires et leurs coefficients.
            </p>
          </div>

          <div className="rounded-[22px] border border-white/80 bg-white/85 px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Matieres renseignees
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{subjectCount}</p>
          </div>
        </div>
      </section>

      <BlockActionSelector
        value={draft.academic_mode}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            academic_mode: value,
          }))
        }
      />

      {draft.academic_mode === "PLUS_TARD" ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-6 text-slate-600">
          Le referentiel academique est reporte pour l'instant. Les niveaux et classes
          peuvent etre poses maintenant, puis les matieres seront branchees plus tard.
        </div>
      ) : levels.length === 0 ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm leading-6 text-amber-800">
          Selectionne d'abord les niveaux pour ouvrir la structuration academique.
        </div>
      ) : (
        <div className="space-y-4">
          {levels.map((level) => {
            const group = groupsByCode.get(level.code) ?? {
              level_code: level.code,
              level_nom: level.nom,
              programme_nom: buildSuggestedProgrammeName(level),
              subjects: [buildEmptyAcademicSubject()],
            };
            const enteredCount = group.subjects.filter((subject) => subject.nom.trim()).length;

            return (
              <article
                key={level.code}
                className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        {level.code}
                      </span>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                        {enteredCount} matiere(s)
                      </span>
                    </div>
                    <h5 className="mt-3 text-base font-semibold text-slate-900">{level.nom}</h5>
                    <p className="mt-1 text-sm text-slate-500">
                      Renseigne le programme de ce niveau puis les matieres qui composent son socle de depart.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateGroup(level, (currentGroup) => ({
                        ...currentGroup,
                        subjects: [...currentGroup.subjects, buildEmptyAcademicSubject()],
                      }))
                    }
                    className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <FiPlus />
                    Ajouter une matiere
                  </button>
                </div>

                <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Nom du programme
                    </span>
                    <input
                      value={group.programme_nom}
                      onChange={(event) =>
                        updateGroup(level, (currentGroup) => ({
                          ...currentGroup,
                          programme_nom: event.target.value,
                        }))
                      }
                      placeholder={buildSuggestedProgrammeName(level)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                    />
                  </label>
                </div>

                <div className="mt-4 space-y-3">
                  {group.subjects.map((subject, index) => (
                    <div
                      key={`${level.code}-subject-${index}`}
                      className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Matiere</p>
                            <p className="text-xs text-slate-500">Code, volume horaire et coefficient</p>
                          </div>
                        </div>

                        {group.subjects.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateGroup(level, (currentGroup) => ({
                                ...currentGroup,
                                subjects: currentGroup.subjects.filter(
                                  (_, subjectIndex) => subjectIndex !== index,
                                ),
                              }))
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                            aria-label={`Supprimer la matiere ${index + 1} du niveau ${level.nom}`}
                          >
                            <FiTrash2 />
                          </button>
                        ) : null}
                      </div>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)]">
                        <div className="min-w-0">
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Nom
                          </label>
                          <div className="relative">
                            <FiBookOpen className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              value={subject.nom}
                              onChange={(event) =>
                                updateGroup(level, (currentGroup) => ({
                                  ...currentGroup,
                                  subjects: currentGroup.subjects.map((entry, subjectIndex) =>
                                    subjectIndex === index
                                      ? { ...entry, nom: event.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                              placeholder="Ex: Francais"
                              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                            />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Code
                          </label>
                          <div className="relative">
                            <FiHash className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              value={subject.code}
                              onChange={(event) =>
                                updateGroup(level, (currentGroup) => ({
                                  ...currentGroup,
                                  subjects: currentGroup.subjects.map((entry, subjectIndex) =>
                                    subjectIndex === index
                                      ? { ...entry, code: event.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                              placeholder="FR"
                              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                            />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            H / semaine
                          </label>
                          <div className="relative">
                            <FiClipboard className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              value={subject.heures_semaine}
                              onChange={(event) =>
                                updateGroup(level, (currentGroup) => ({
                                  ...currentGroup,
                                  subjects: currentGroup.subjects.map((entry, subjectIndex) =>
                                    subjectIndex === index
                                      ? { ...entry, heures_semaine: event.target.value }
                                      : entry,
                                  ),
                                }))
                              }
                              placeholder="4"
                              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                            />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Coefficient
                          </label>
                          <input
                            value={subject.coefficient}
                            onChange={(event) =>
                              updateGroup(level, (currentGroup) => ({
                                ...currentGroup,
                                subjects: currentGroup.subjects.map((entry, subjectIndex) =>
                                  subjectIndex === index
                                    ? { ...entry, coefficient: event.target.value }
                                    : entry,
                                ),
                              }))
                            }
                            placeholder="1"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
