import React from "react";
import {
  FiColumns,
  FiGrid,
  FiLayers,
  FiRefreshCw,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../../hooks/useAuth";
import { formatDateWithLocalTimezone } from "../../../../app/utils/functions";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import ClasseService from "../../../../services/classe.service";
import CreneauHoraireService from "../../../../services/creneauHoraire.service";
import EmploiDuTempsService, {
  EMPLOI_DU_TEMPS_INCLUDE_SPEC,
  EMPLOI_DU_TEMPS_ORDER_BY,
  type EmploiDuTempsWithRelations,
} from "../../../../services/emploiDuTemps.service";
import type { Classe, CreneauHoraire } from "../../../../types/models";
import { useEmploiDuTempsDashboardStore } from "../../store/EmploiDuTempsDashboardStore";
import ScheduleGridListView from "./ScheduleGridListView";
import ScheduleKanbanView from "./ScheduleKanbanView";
import { getScheduleScopeMeta } from "../../types";

type ScopeFilter = "all" | "recurrent" | "specific";
type ViewMode = "grid" | "kanban";

type CurrentYear = {
  id: string;
  nom: string;
  date_debut: Date | string;
  date_fin: Date | string;
};

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Impossible de charger la liste de l'emploi du temps pour le moment.";
}

function formatDate(value?: Date | string | null) {
  return value ? formatDateWithLocalTimezone(value.toString()).date : "-";
}

function buildSearchWhere(text: string) {
  return {
    OR: [
      { classe: { nom: { contains: text } } },
      { cours: { classe: { nom: { contains: text } } } },
      { matiere: { nom: { contains: text } } },
      { cours: { matiere: { nom: { contains: text } } } },
      { salle: { nom: { contains: text } } },
      { salle: { site: { nom: { contains: text } } } },
      { creneau: { nom: { contains: text } } },
      { enseignant: { personnel: { code_personnel: { contains: text } } } },
      { enseignant: { personnel: { utilisateur: { profil: { prenom: { contains: text } } } } } },
      { enseignant: { personnel: { utilisateur: { profil: { nom: { contains: text } } } } } },
    ],
  };
}

export default function ScheduleList() {
  const { etablissement_id } = useAuth();
  const service = React.useMemo(() => new EmploiDuTempsService(), []);
  const dashboardSelectedClasseId = useEmploiDuTempsDashboardStore(
    (state) => state.selectedClasseId,
  );

  const [classes, setClasses] = React.useState<Classe[]>([]);
  const [creneaux, setCreneaux] = React.useState<CreneauHoraire[]>([]);
  const [selectedClasseFilter, setSelectedClasseFilter] = React.useState("");
  const [scopeFilter, setScopeFilter] = React.useState<ScopeFilter>("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [searchInput, setSearchInput] = React.useState("");
  const [appliedSearch, setAppliedSearch] = React.useState("");
  const [currentYear, setCurrentYear] = React.useState<CurrentYear | null>(null);
  const [previewRows, setPreviewRows] = React.useState<EmploiDuTempsWithRelations[]>([]);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState("");

  React.useEffect(() => {
    if (!selectedClasseFilter && dashboardSelectedClasseId) {
      setSelectedClasseFilter(dashboardSelectedClasseId);
    }
  }, [dashboardSelectedClasseId, selectedClasseFilter]);

  React.useEffect(() => {
    const loadFilters = async () => {
      if (!etablissement_id) {
        setClasses([]);
        setCreneaux([]);
        setCurrentYear(null);
        return;
      }

      try {
        const classeService = new ClasseService();
        const creneauService = new CreneauHoraireService();

        const [year, classesResult, creneauxResult] = await Promise.all([
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
          creneauService.getAll({
            take: 500,
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ ordre: "asc" }, { heure_debut: "asc" }]),
          }),
        ]);

        setCurrentYear((year as CurrentYear | null) ?? null);
        setClasses(classesResult?.status.success ? classesResult.data.data : []);
        setCreneaux(creneauxResult?.status.success ? creneauxResult.data.data : []);
      } catch {
        setCurrentYear(null);
        setClasses([]);
        setCreneaux([]);
      }
    };

    void loadFilters();
  }, [etablissement_id]);

  const selectedClasse = React.useMemo(
    () => classes.find((item) => item.id === selectedClasseFilter) ?? null,
    [classes, selectedClasseFilter],
  );

  const sharedWhere = React.useMemo(() => {
    if (!etablissement_id) return {};

    const clauses: Record<string, unknown>[] = [
      {
        classe: {
          etablissement_id,
          ...(selectedClasseFilter ? { id: selectedClasseFilter } : {}),
        },
      },
    ];

    if (currentYear?.date_debut && currentYear?.date_fin) {
      clauses.push({
        effectif_du: { lte: currentYear.date_fin },
        effectif_au: { gte: currentYear.date_debut },
      });

      if (scopeFilter === "recurrent") {
        clauses.push({
          effectif_du: { lte: currentYear.date_debut },
          effectif_au: { gte: currentYear.date_fin },
        });
      }

      if (scopeFilter === "specific") {
        clauses.push({
          OR: [
            { effectif_du: { gt: currentYear.date_debut } },
            { effectif_au: { lt: currentYear.date_fin } },
          ],
        });
      }
    }

    if (appliedSearch) {
      clauses.push(buildSearchWhere(appliedSearch));
    }

    return clauses.length === 1 ? clauses[0] : { AND: clauses };
  }, [
    appliedSearch,
    currentYear?.date_debut,
    currentYear?.date_fin,
    etablissement_id,
    scopeFilter,
    selectedClasseFilter,
  ]);

  const loadPreviewRows = React.useCallback(async () => {
    if (!etablissement_id) {
      setPreviewRows([]);
      setPreviewError("");
      return;
    }

    setPreviewLoading(true);
    setPreviewError("");

    try {
      const result = await service.getForEtablissement(etablissement_id, {
        page: 1,
        take: 1000,
        where: sharedWhere,
        includeSpec: EMPLOI_DU_TEMPS_INCLUDE_SPEC,
        orderBy: EMPLOI_DU_TEMPS_ORDER_BY,
      });

      setPreviewRows(
        result?.status.success
          ? ((result.data.data as EmploiDuTempsWithRelations[]) ?? [])
          : [],
      );
    } catch (error: unknown) {
      setPreviewRows([]);
      setPreviewError(getErrorMessage(error));
    } finally {
      setPreviewLoading(false);
    }
  }, [etablissement_id, service, sharedWhere]);

  React.useEffect(() => {
    void loadPreviewRows();
  }, [loadPreviewRows]);

  const refreshAll = React.useCallback(async () => {
    await loadPreviewRows();
  }, [loadPreviewRows]);

  const handleApplySearch = React.useCallback(() => {
    setAppliedSearch(searchInput.trim());
  }, [searchInput]);

  const handleResetFilters = React.useCallback(() => {
    setSearchInput("");
    setAppliedSearch("");
    setScopeFilter("all");
    setSelectedClasseFilter(dashboardSelectedClasseId ?? "");
  }, [dashboardSelectedClasseId]);

  const handleDelete = React.useCallback(
    async (row: EmploiDuTempsWithRelations) => {
      const confirmed = window.confirm("Supprimer cette ligne d'emploi du temps ?");
      if (!confirmed) return;

      await service.delete(row.id);
      await refreshAll();
    },
    [refreshAll, service],
  );

  const totalRows = previewRows.length;
  const classesCount = new Set(previewRows.map((row) => row.classe_id).filter(Boolean)).size;
  const teachersCount = new Set(
    previewRows.map((row) => row.enseignant_id).filter((value): value is string => Boolean(value)),
  ).size;
  const specificRows = previewRows.filter(
    (row) => getScheduleScopeMeta(row).label === "Specifique",
  ).length;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_48%,_#ecfeff_100%)] px-6 py-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Liste emploi du temps
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Cette vue reprend maintenant la logique de grille du dashboard, avec fusion des blocs
              contigus quand la meme matiere occupe plusieurs creneaux consecutifs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                viewMode === "grid"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <FiGrid />
              Grille
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                viewMode === "kanban"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <FiColumns />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <FiRefreshCw />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_0.8fr_0.8fr_auto]">
          <label className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recherche
            </span>
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <FiSearch className="text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleApplySearch();
                  }
                }}
                placeholder="Classe, matiere, enseignant, salle..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Recherche partagee entre la grille et le kanban.
            </p>
          </label>

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
                  : "Filtre la lecture sur une seule classe si besoin."}
            </p>
          </label>

          <label className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Portee
            </span>
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="all">Toutes</option>
              <option value="recurrent">Recurrentes</option>
              <option value="specific">Specifiques</option>
            </select>
            <p className="mt-2 text-xs text-slate-500">
              {scopeFilter === "all"
                ? "Vue mixte annuelle et specifique."
                : scopeFilter === "recurrent"
                  ? "Base annuelle uniquement."
                  : "Overrides et semaines specifiques uniquement."}
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
                ? `${formatDate(currentYear.date_debut)} - ${formatDate(currentYear.date_fin)}`
                : "Les vues se calent sur l'annee active quand elle est disponible."}
            </p>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <button
              type="button"
              onClick={handleApplySearch}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <FiSearch />
              Appliquer
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reinitialiser
            </button>
          </div>
        </div>

        {appliedSearch ? (
          <div className="mt-4 inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
            Recherche active: {appliedSearch}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Lignes visibles</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{totalRows}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiGrid />
            <span className="text-sm font-medium">Classes couvertes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{classesCount}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Enseignants relies</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{teachersCount}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiColumns />
            <span className="text-sm font-medium">Lignes specifiques</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{specificRows}</p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {viewMode === "grid" ? "Vue grille" : "Vue kanban"}
            </h3>
            <p className="text-sm text-slate-500">
              {viewMode === "grid"
                ? "Lecture proche du dashboard, avec fusion verticale des cases equivalentes."
                : "Lecture hebdomadaire par jour pour reperer plus vite les collisions et les trous."}
            </p>
          </div>
          {previewError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
              {previewError}
            </div>
          ) : null}
        </div>

        {viewMode === "grid" ? (
          <ScheduleGridListView
            rows={previewRows}
            creneaux={creneaux}
            loading={previewLoading}
            errorMessage={previewError}
            onDelete={handleDelete}
          />
        ) : (
          <ScheduleKanbanView
            rows={previewRows}
            loading={previewLoading}
            errorMessage={previewError}
            onDelete={handleDelete}
            showClasse={!selectedClasseFilter}
          />
        )}
      </section>
    </div>
  );
}
