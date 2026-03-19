import React from "react";
import { useAuth } from "../../../../hooks/useAuth";
import { formatDateWithLocalTimezone } from "../../../../app/utils/functions";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import ClasseService from "../../../../services/classe.service";
import EmploiDuTempsService from "../../../../services/emploiDuTemps.service";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../shared/table/types";
import type { Classe, EmploiDuTemps } from "../../../../types/models";
import { useEmploiDuTempsDashboardStore } from "../../store/EmploiDuTempsDashboardStore";
import {
  getCreneauLabel,
  getScheduleScopeMeta,
  getTeacherDisplayLabel,
  getWeekdayLabel,
} from "../../types";

type ScopeFilter = "all" | "recurrent" | "specific";

export default function ScheduleList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new EmploiDuTempsService(), []);
  const dashboardSelectedClasseId = useEmploiDuTempsDashboardStore(
    (state) => state.selectedClasseId,
  );

  const [classes, setClasses] = React.useState<Classe[]>([]);
  const [selectedClasseFilter, setSelectedClasseFilter] = React.useState("");
  const [scopeFilter, setScopeFilter] = React.useState<ScopeFilter>("all");
  const [currentYear, setCurrentYear] = React.useState<{
    id: string;
    nom: string;
    date_debut: Date | string;
    date_fin: Date | string;
  } | null>(null);

  React.useEffect(() => {
    if (!selectedClasseFilter && dashboardSelectedClasseId) {
      setSelectedClasseFilter(dashboardSelectedClasseId);
    }
  }, [dashboardSelectedClasseId, selectedClasseFilter]);

  React.useEffect(() => {
    const loadFilters = async () => {
      if (!etablissement_id) {
        setClasses([]);
        setCurrentYear(null);
        return;
      }

      try {
        const classeService = new ClasseService();
        const [year, classesResult] = await Promise.all([
          anneeScolaireService.getCurrent(etablissement_id),
          classeService.getAll({
            take: 5000,
            where: JSON.stringify({ etablissement_id }),
            includeSpec: JSON.stringify({
              niveau: true,
              site: true,
            }),
            orderBy: JSON.stringify([{ nom: "asc" }]),
          }),
        ]);

        setCurrentYear(year ?? null);
        setClasses(classesResult?.status.success ? classesResult.data.data : []);
      } catch {
        setCurrentYear(null);
        setClasses([]);
      }
    };

    void loadFilters();
  }, [etablissement_id]);

  const selectedClasse = React.useMemo(
    () => classes.find((item) => item.id === selectedClasseFilter) ?? null,
    [classes, selectedClasseFilter],
  );

  const baseWhere = React.useMemo(() => {
    if (!etablissement_id) return {};

    const where: Record<string, unknown> = {
      classe: {
        etablissement_id,
        ...(selectedClasseFilter ? { id: selectedClasseFilter } : {}),
      },
    };

    const andClauses: Record<string, unknown>[] = [where];

    if (currentYear?.date_debut && currentYear?.date_fin) {
      andClauses.push({
        effectif_du: { lte: currentYear.date_fin },
        effectif_au: { gte: currentYear.date_debut },
      });

      if (scopeFilter === "recurrent") {
        andClauses.push({
          effectif_du: { lte: currentYear.date_debut },
          effectif_au: { gte: currentYear.date_fin },
        });
      }

      if (scopeFilter === "specific") {
        andClauses.push({
          OR: [
            { effectif_du: { gt: currentYear.date_debut } },
            { effectif_au: { lt: currentYear.date_fin } },
          ],
        });
      }
    }

    return andClauses.length === 1 ? andClauses[0] : { AND: andClauses };
  }, [currentYear?.date_debut, currentYear?.date_fin, etablissement_id, scopeFilter, selectedClasseFilter]);

  const tableKey = React.useMemo(
    () =>
      JSON.stringify({
        selectedClasseFilter,
        scopeFilter,
        yearStart: currentYear?.date_debut ?? null,
        yearEnd: currentYear?.date_fin ?? null,
      }),
    [currentYear?.date_debut, currentYear?.date_fin, scopeFilter, selectedClasseFilter],
  );

  const columns: ColumnDef<EmploiDuTemps>[] = [
    {
      key: "classe",
      header: "Classe",
      render: (row) => row.classe?.nom ?? row.cours?.classe?.nom ?? "-",
    },
    {
      key: "jour_semaine",
      header: "Jour",
      render: (row) => getWeekdayLabel(row.jour_semaine),
      sortable: true,
      sortKey: "jour_semaine",
    },
    {
      key: "creneau",
      header: "Creneau",
      render: (row) => getCreneauLabel(row.creneau),
    },
    {
      key: "matiere",
      header: "Matiere",
      render: (row) =>
        row.matiere?.nom ??
        row.cours?.matiere?.nom ??
        (!row.cours_id && !row.matiere_id ? "Pause" : "-"),
    },
    {
      key: "enseignant",
      header: "Enseignant",
      render: (row) => getTeacherDisplayLabel(row.enseignant),
    },
    {
      key: "salle",
      header: "Salle",
      render: (row) => row.salle?.nom ?? "-",
    },
    {
      key: "portee",
      header: "Type",
      render: (row) => {
        const scope = getScheduleScopeMeta(row);
        return (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${scope.tone}`}
          >
            {scope.label}
          </span>
        );
      },
    },
    {
      key: "effectif_du",
      header: "Actif du",
      render: (row) =>
        row.effectif_du
          ? formatDateWithLocalTimezone(row.effectif_du.toString()).dateHeure
          : "-",
    },
    {
      key: "effectif_au",
      header: "Actif au",
      render: (row) =>
        row.effectif_au
          ? formatDateWithLocalTimezone(row.effectif_au.toString()).dateHeure
          : "-",
    },
  ];

  const actions: RowAction<EmploiDuTemps>[] = [
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer cette ligne d'emploi du temps ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_50%,_#eef2ff_100%)] px-6 py-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Lignes d'emploi du temps
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          La liste est maintenant cadree sur l'annee scolaire active, avec filtres
          par classe et par type pour eviter le melange entre recurrent et
          specifique.
        </p>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="mb-5 grid gap-4 md:grid-cols-[minmax(220px,280px)_minmax(200px,240px)_1fr]">
          <label className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Classe
            </span>
            <select
              value={selectedClasseFilter}
              onChange={(event) => setSelectedClasseFilter(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="">Toutes les classes</option>
              {classes.map((classe) => (
                <option key={classe.id} value={classe.id}>
                  {classe.nom}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              {selectedClasse?.site?.nom
                ? `${selectedClasse.site.nom} - ${selectedClasse?.niveau?.nom ?? "Niveau"}`
                : dashboardSelectedClasseId && !selectedClasseFilter
                  ? "La classe active du dashboard peut etre reprise ici."
                  : "Filtre la liste pour une lecture plus propre."}
            </p>
          </label>

          <label className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Type
            </span>
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="all">Tous</option>
              <option value="recurrent">Recurrent uniquement</option>
              <option value="specific">Specifique uniquement</option>
            </select>
            <p className="mt-2 text-xs text-slate-500">
              {scopeFilter === "all"
                ? "Affiche ensemble les lignes recurrentes et les overrides."
                : scopeFilter === "recurrent"
                  ? "Affiche seulement la base annuelle de la classe."
                  : "Affiche seulement les semaines specifiques enregistrees."}
            </p>
          </label>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Annee scolaire
            </p>
            <p className="mt-3 text-base font-semibold text-slate-900">
              {currentYear?.nom ?? "Non definie"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {currentYear?.date_debut && currentYear?.date_fin
                ? `${formatDateWithLocalTimezone(currentYear.date_debut.toString()).date} - ${formatDateWithLocalTimezone(currentYear.date_fin.toString()).date}`
                : "La liste n'affiche que l'annee scolaire active quand elle existe."}
            </p>
          </div>
        </div>

        <DataTable<EmploiDuTemps>
          key={tableKey}
          ref={tableRef}
          service={service}
          columns={columns}
          actions={actions}
          getRowId={(row) => row.id}
          initialQuery={{
            page: 1,
            take: 10,
            where: baseWhere,
            includeSpec: {
              classe: true,
              cours: {
                include: {
                  classe: true,
                  matiere: true,
                },
              },
              matiere: true,
              enseignant: {
                include: {
                  personnel: {
                    include: {
                      utilisateur: {
                        include: {
                          profil: true,
                        },
                      },
                    },
                  },
                },
              },
              salle: {
                include: {
                  site: true,
                },
              },
              creneau: true,
            },
            orderBy: [
              { jour_semaine: "asc" },
              { creneau: { ordre: "asc" } },
              { creneau: { heure_debut: "asc" } },
            ],
          }}
          showSearch
          onSearchBuildWhere={(text) => ({
            AND: [
              baseWhere,
              {
                OR: [
                  { classe: { nom: { contains: text } } },
                  { cours: { classe: { nom: { contains: text } } } },
                  { matiere: { nom: { contains: text } } },
                  { cours: { matiere: { nom: { contains: text } } } },
                  { salle: { nom: { contains: text } } },
                  { creneau: { nom: { contains: text } } },
                ],
              },
            ],
          })}
        />
      </section>
    </div>
  );
}
