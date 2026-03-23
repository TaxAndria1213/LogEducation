import type { CreneauHoraire } from "../../../../types/models";
import Spin from "../../../../components/anim/Spin";
import type { EmploiDuTempsWithRelations } from "../../../../services/emploiDuTemps.service";
import {
  getScheduleClasseLabel,
  getScheduleDateWindowLabel,
  getScheduleRoomLabel,
  getScheduleScopeMeta,
  getScheduleSubjectLabel,
  getTeacherDisplayLabel,
  getWeekdayLabel,
  WEEKDAY_OPTIONS,
} from "../../types";
import {
  getCoveredVirtualCreneauIds,
  toMinutes,
} from "../../utils/virtualCreneaux";

type Props = {
  rows: EmploiDuTempsWithRelations[];
  creneaux: CreneauHoraire[];
  loading: boolean;
  errorMessage: string;
  onDelete: (row: EmploiDuTempsWithRelations) => Promise<void>;
};

type MergeInfo = {
  rowSpan: number;
  hiddenKeys: Set<string>;
  byKey: Record<
    string,
    {
      rowSpan: number;
      rowIds: string[];
      primaryRow: EmploiDuTempsWithRelations | null;
    }
  >;
};

function getRowKey(day: number, creneauId: string) {
  return `${day}::${creneauId}`;
}

function sortCreneaux(left: CreneauHoraire, right: CreneauHoraire) {
  const leftOrder = left.ordre ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.ordre ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return (left.heure_debut ?? "99:99").localeCompare(right.heure_debut ?? "99:99");
}

function sortRowsByDayAndTime(
  left: EmploiDuTempsWithRelations,
  right: EmploiDuTempsWithRelations,
) {
  if (left.jour_semaine !== right.jour_semaine) {
    return left.jour_semaine - right.jour_semaine;
  }

  const leftStart = toMinutes(left.heure_debut ?? left.creneau?.heure_debut) ?? Number.MAX_SAFE_INTEGER;
  const rightStart = toMinutes(right.heure_debut ?? right.creneau?.heure_debut) ?? Number.MAX_SAFE_INTEGER;

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  const leftEnd = toMinutes(left.heure_fin ?? left.creneau?.heure_fin) ?? Number.MAX_SAFE_INTEGER;
  const rightEnd = toMinutes(right.heure_fin ?? right.creneau?.heure_fin) ?? Number.MAX_SAFE_INTEGER;

  if (leftEnd !== rightEnd) {
    return leftEnd - rightEnd;
  }

  return String(left.created_at).localeCompare(String(right.created_at));
}

function getMergeSignature(row?: EmploiDuTempsWithRelations | null) {
  if (!row) return null;

  return [
    getScheduleSubjectLabel(row),
    getTeacherDisplayLabel(row.enseignant),
    getScheduleRoomLabel(row),
    getScheduleScopeMeta(row).label,
  ].join("::");
}

function buildMergedCells(
  rows: EmploiDuTempsWithRelations[],
  creneaux: CreneauHoraire[],
): MergeInfo {
  const bySlot = new Map<string, EmploiDuTempsWithRelations>();
  [...rows].sort(sortRowsByDayAndTime).forEach((row) => {
    getCoveredVirtualCreneauIds(row, creneaux).forEach((creneauId) => {
      const key = getRowKey(row.jour_semaine, creneauId);
      if (!bySlot.has(key)) {
        bySlot.set(key, row);
      }
    });
  });

  const hiddenKeys = new Set<string>();
  const byKey: MergeInfo["byKey"] = {};

  WEEKDAY_OPTIONS.forEach((day) => {
    let index = 0;

    while (index < creneaux.length) {
      const creneau = creneaux[index];
      const key = getRowKey(day.value, creneau.id);
      const currentRow = bySlot.get(key) ?? null;
      const signature = getMergeSignature(currentRow);

      let rowSpan = 1;
      const rowIds = currentRow ? [currentRow.id] : [];

      if (signature) {
        while (index + rowSpan < creneaux.length) {
          const nextCreneau = creneaux[index + rowSpan];
          const nextKey = getRowKey(day.value, nextCreneau.id);
          const nextRow = bySlot.get(nextKey) ?? null;
          const nextSignature = getMergeSignature(nextRow);

          if (nextSignature !== signature) {
            break;
          }

          if (nextRow) {
            rowIds.push(nextRow.id);
          }
          hiddenKeys.add(nextKey);
          rowSpan += 1;
        }
      }

      byKey[key] = {
        rowSpan,
        rowIds,
        primaryRow: currentRow,
      };

      index += rowSpan;
    }
  });

  return { rowSpan: 1, hiddenKeys, byKey };
}

function GroupGrid({
  title,
  rows,
  creneaux,
  onDelete,
}: {
  title: string;
  rows: EmploiDuTempsWithRelations[];
  creneaux: CreneauHoraire[];
  onDelete: (row: EmploiDuTempsWithRelations) => Promise<void>;
}) {
  const bySlot = new Map<string, EmploiDuTempsWithRelations>();
  [...rows].sort(sortRowsByDayAndTime).forEach((row) => {
    getCoveredVirtualCreneauIds(row, creneaux).forEach((creneauId) => {
      const key = getRowKey(row.jour_semaine, creneauId);
      if (!bySlot.has(key)) {
        bySlot.set(key, row);
      }
    });
  });

  const merged = buildMergedCells(rows, creneaux);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.25)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          <p className="text-sm text-slate-500">
            Projection en grille `30 min` avec fusion automatique identique au dashboard.
          </p>
        </div>
        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Grille virtuelle 30 min
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <table className="w-full table-fixed border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-[170px] border border-slate-200 bg-white/95 px-3 py-2 text-left text-xs font-semibold text-slate-700 backdrop-blur">
                  Creneaux
                </th>
                {WEEKDAY_OPTIONS.map((day) => (
                  <th
                    key={day.value}
                    className="border border-slate-200 bg-white/90 px-3 py-2 text-left text-xs font-semibold text-slate-800"
                  >
                    {getWeekdayLabel(day.value)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creneaux.map((creneau) => (
                <tr key={creneau.id}>
                  <th className="sticky left-0 z-10 border border-slate-200 bg-white/95 px-3 py-2 text-left text-xs font-semibold text-slate-900 backdrop-blur">
                    <span className="block">{creneau.nom}</span>
                    <span className="mt-1 block text-[11px] font-medium text-slate-500">
                      {creneau.heure_debut} - {creneau.heure_fin}
                    </span>
                  </th>
                  {WEEKDAY_OPTIONS.map((day) => {
                    const cellKey = getRowKey(day.value, creneau.id);

                    if (merged.hiddenKeys.has(cellKey)) {
                      return null;
                    }

                    const mergeInfo = merged.byKey[cellKey] ?? {
                      rowSpan: 1,
                      rowIds: [],
                      primaryRow: null,
                    };
                    const row = mergeInfo.primaryRow ?? bySlot.get(cellKey) ?? null;
                    const scope = row ? getScheduleScopeMeta(row) : null;
                    const minHeight = 52 * mergeInfo.rowSpan;

                    return (
                      <td key={cellKey} rowSpan={mergeInfo.rowSpan} className="p-0 align-top">
                        <div
                          style={{ minHeight }}
                          className={`group flex h-full flex-col justify-center border text-center transition-all duration-150 ${
                            row
                              ? "border-emerald-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f0fdf4_100%)] hover:border-emerald-300"
                              : "border-slate-200 bg-white/90 hover:border-cyan-300"
                          } ${mergeInfo.rowSpan > 1 ? "px-2.5 py-2" : "px-2.5 py-1.5"}`}
                        >
                          {row ? (
                            <div className="flex h-full flex-col items-center justify-center space-y-1.5">
                              <p className="line-clamp-3 text-sm font-semibold text-slate-900">
                                {getScheduleSubjectLabel(row)}
                              </p>
                              <p className="max-w-full line-clamp-2 break-words text-[11px] font-medium text-slate-500">
                                {getTeacherDisplayLabel(row.enseignant)}
                              </p>
                              <div className="flex flex-wrap items-center justify-center gap-1.5">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                  {getScheduleRoomLabel(row)}
                                </span>
                                {scope ? (
                                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${scope.tone}`}>
                                    {scope.label}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-[10px] text-slate-400">
                                {getScheduleDateWindowLabel(row)}
                              </p>
                              <button
                                type="button"
                                onClick={() => void onDelete(row)}
                                className="mt-1 rounded-xl border border-rose-200 px-2.5 py-1 text-[10px] font-semibold text-rose-700 opacity-0 transition hover:bg-rose-50 group-hover:opacity-100"
                              >
                                Supprimer
                              </button>
                            </div>
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-slate-300">
                              -
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function ScheduleGridListView({
  rows,
  creneaux,
  loading,
  errorMessage,
  onDelete,
}: Props) {
  const orderedCreneaux = [...creneaux].sort(sortCreneaux);

  const groups = Object.values(
    rows.reduce<Record<string, { label: string; rows: EmploiDuTempsWithRelations[] }>>((acc, row) => {
      const key = row.classe_id;
      if (!acc[key]) {
        acc[key] = {
          label: getScheduleClasseLabel(row),
          rows: [],
        };
      }
      acc[key].rows.push(row);
      return acc;
    }, {}),
  ).sort((left, right) => left.label.localeCompare(right.label));

  if (loading) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-10">
        <Spin label="Chargement de la grille de l'emploi du temps..." showLabel />
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

  if (orderedCreneaux.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Aucun creneau n'est encore configure pour afficher la grille.
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
        Aucune ligne d'emploi du temps ne correspond aux filtres actifs.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <GroupGrid
          key={group.label}
          title={group.label}
          rows={group.rows}
          creneaux={orderedCreneaux}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
