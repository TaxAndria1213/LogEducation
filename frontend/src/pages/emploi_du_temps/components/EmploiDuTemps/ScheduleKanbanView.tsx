import Spin from "../../../../components/anim/Spin";
import type { EmploiDuTempsWithRelations } from "../../../../services/emploiDuTemps.service";
import {
  getCreneauLabel,
  getScheduleClasseLabel,
  getScheduleDateWindowLabel,
  getScheduleRoomLabel,
  getScheduleScopeMeta,
  getScheduleSubjectLabel,
  getTeacherDisplayLabel,
  getWeekdayLabel,
  WEEKDAY_OPTIONS,
} from "../../types";

type Props = {
  rows: EmploiDuTempsWithRelations[];
  loading: boolean;
  errorMessage: string;
  onDelete: (row: EmploiDuTempsWithRelations) => Promise<void>;
  showClasse?: boolean;
};

function sortRows(left: EmploiDuTempsWithRelations, right: EmploiDuTempsWithRelations) {
  const leftOrder = left.creneau?.ordre ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.creneau?.ordre ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const leftHour = left.heure_debut ?? left.creneau?.heure_debut ?? "99:99";
  const rightHour = right.heure_debut ?? right.creneau?.heure_debut ?? "99:99";
  return leftHour.localeCompare(rightHour);
}

export default function ScheduleKanbanView({
  rows,
  loading,
  errorMessage,
  onDelete,
  showClasse = true,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-10">
        <Spin label="Chargement de la vue kanban..." showLabel />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
        {errorMessage}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Aucune ligne d'emploi du temps ne correspond aux filtres actifs.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1180px] grid-cols-7 gap-4">
        {WEEKDAY_OPTIONS.map((day) => {
          const dayRows = rows
            .filter((row) => row.jour_semaine === day.value)
            .sort(sortRows);

          return (
            <section
              key={day.value}
              className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-3 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.35)]"
            >
              <div className="mb-3 rounded-[20px] bg-white px-4 py-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{getWeekdayLabel(day.value)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {dayRows.length} ligne(s) planifiee(s)
                </p>
              </div>

              <div className="space-y-3">
                {dayRows.length > 0 ? (
                  dayRows.map((row) => {
                    const scope = getScheduleScopeMeta(row);
                    const subject = getScheduleSubjectLabel(row);
                    const teacher = getTeacherDisplayLabel(row.enseignant);
                    const room = getScheduleRoomLabel(row);
                    const dateWindow = getScheduleDateWindowLabel(row);

                    return (
                      <article
                        key={row.id}
                        className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-26px_rgba(15,23,42,0.28)]"
                      >
                        <div className="flex flex-col items-start gap-2">
                          <span
                            className={`max-w-full rounded-full px-2.5 py-1 text-[11px] font-semibold ${scope.tone}`}
                          >
                            {scope.label}
                          </span>
                          <div className="min-w-0 w-full">
                            <p className="line-clamp-2 break-words text-sm font-semibold text-slate-900">
                              {subject}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {[row.heure_debut ?? row.creneau?.heure_debut, row.heure_fin ?? row.creneau?.heure_fin]
                                .filter(Boolean)
                                .join(" - ") || getCreneauLabel(row.creneau)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 min-w-0 space-y-2 text-xs leading-5 text-slate-600">
                          {showClasse ? (
                            <p className="break-words">
                              <span className="font-semibold text-slate-700">Classe:</span>{" "}
                              {getScheduleClasseLabel(row)}
                            </p>
                          ) : null}
                          <p className="break-words">
                            <span className="font-semibold text-slate-700">Enseignant:</span>{" "}
                            <span className="line-clamp-2 inline-block max-w-full align-top">
                              {teacher}
                            </span>
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Salle:</span>{" "}
                            {room}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Fenetre:</span>{" "}
                            {dateWindow}
                          </p>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => void onDelete(row)}
                            className="inline-flex items-center rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            Supprimer
                          </button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-400">
                    Aucun cours sur {getWeekdayLabel(day.value).toLowerCase()}.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
