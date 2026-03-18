import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiInfo,
  FiMapPin,
  FiLayers,
  FiRefreshCw,
  FiRotateCcw,
  FiSave,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../../auth/AuthContext";
import Spin from "../../../../components/anim/Spin";
import { useInfo } from "../../../../hooks/useInfo";
import { useEmploiDuTempsDashboardStore } from "../../store/EmploiDuTempsDashboardStore";
import {
  WEEKDAY_OPTIONS,
  getPlannerCellKey,
  getTeacherDisplayLabel,
  getTeacherSecondaryLabel,
} from "../../types";

function formatShortDate(value?: Date | string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getCourseLabel(course: {
  matiere?: { nom?: string | null } | null;
  enseignant?: {
    personnel?: {
      code_personnel?: string | null;
      poste?: string | null;
      utilisateur?: {
        profil?: {
          prenom?: string | null;
          nom?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
}) {
  const matiere = course.matiere?.nom ?? "Matiere";
  return `${matiere} - ${getTeacherDisplayLabel(course.enseignant)}`;
}

function getRoomLabel(room: { nom: string; site?: { nom?: string | null } | null }) {
  return room.site?.nom ? `${room.nom} - ${room.site.nom}` : room.nom;
}

function StatCard({
  icon,
  label,
  value,
  accent,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  accent: string;
  helper: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.4)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg shadow-inner ${accent}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export default function ScheduleDashboard() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [collapsedRows, setCollapsedRows] = useState<Record<string, boolean>>({});

  const loading = useEmploiDuTempsDashboardStore((state) => state.loading);
  const loadingPlanning = useEmploiDuTempsDashboardStore(
    (state) => state.loadingPlanning,
  );
  const saving = useEmploiDuTempsDashboardStore((state) => state.saving);
  const error = useEmploiDuTempsDashboardStore((state) => state.error);
  const currentYear = useEmploiDuTempsDashboardStore((state) => state.currentYear);
  const classes = useEmploiDuTempsDashboardStore((state) => state.classes);
  const courses = useEmploiDuTempsDashboardStore((state) => state.courses);
  const creneaux = useEmploiDuTempsDashboardStore((state) => state.creneaux);
  const salles = useEmploiDuTempsDashboardStore((state) => state.salles);
  const planner = useEmploiDuTempsDashboardStore((state) => state.planner);
  const selectedClasseId = useEmploiDuTempsDashboardStore(
    (state) => state.selectedClasseId,
  );
  const initialize = useEmploiDuTempsDashboardStore((state) => state.initialize);
  const selectClasse = useEmploiDuTempsDashboardStore((state) => state.selectClasse);
  const updatePlannerCell = useEmploiDuTempsDashboardStore(
    (state) => state.updatePlannerCell,
  );
  const clearPlanner = useEmploiDuTempsDashboardStore((state) => state.clearPlanner);
  const resetFromExisting = useEmploiDuTempsDashboardStore(
    (state) => state.resetFromExisting,
  );
  const savePlanning = useEmploiDuTempsDashboardStore((state) => state.savePlanning);

  useEffect(() => {
    if (etablissement_id) {
      initialize(etablissement_id);
    }
  }, [etablissement_id, initialize]);

  const selectedClasse = useMemo(
    () => classes.find((item) => item.id === selectedClasseId) ?? null,
    [classes, selectedClasseId],
  );

  const plannedSlots = useMemo(
    () => Object.values(planner).filter((cell) => cell?.cours_id).length,
    [planner],
  );

  const assignedRooms = useMemo(() => {
    return new Set(
      Object.values(planner)
        .map((cell) => cell?.salle_id)
        .filter(Boolean),
    ).size;
  }, [planner]);

  const unplannedCourses = useMemo(() => {
    const usedCourses = new Set(
      Object.values(planner)
        .map((cell) => cell?.cours_id)
        .filter(Boolean),
    );

    return courses.filter((course) => !usedCourses.has(course.id)).length;
  }, [courses, planner]);

  const visibleDays = useMemo(
    () => WEEKDAY_OPTIONS.filter((day) => day.value <= 6),
    [],
  );

  const totalSlots = visibleDays.length * creneaux.length;

  const courseUsageById = useMemo(() => {
    return Object.values(planner).reduce<Record<string, number>>((acc, cell) => {
      if (!cell?.cours_id) return acc;
      acc[cell.cours_id] = (acc[cell.cours_id] ?? 0) + 1;
      return acc;
    }, {});
  }, [planner]);

  const selectedCourseByCell = useMemo(() => {
    return Object.fromEntries(
      Object.entries(planner).map(([key, cell]) => [
        key,
        courses.find((course) => course.id === cell?.cours_id) ?? null,
      ]),
    );
  }, [courses, planner]);

  const roomById = useMemo(
    () => Object.fromEntries(salles.map((room) => [room.id, room])),
    [salles],
  );

  const plannedByDay = useMemo(() => {
    return visibleDays.reduce<Record<number, number>>((acc, day) => {
      acc[day.value] = creneaux.reduce((count, creneau) => {
        const key = getPlannerCellKey(day.value, creneau.id);
        return count + (planner[key]?.cours_id ? 1 : 0);
      }, 0);
      return acc;
    }, {});
  }, [creneaux, planner, visibleDays]);

  const plannedByCreneau = useMemo(() => {
    return Object.fromEntries(
      creneaux.map((creneau) => [
        creneau.id,
        visibleDays.reduce((count, day) => {
          const key = getPlannerCellKey(day.value, creneau.id);
          return count + (planner[key]?.cours_id ? 1 : 0);
        }, 0),
      ]),
    );
  }, [creneaux, planner, visibleDays]);

  const toggleRow = (creneauId: string) => {
    const isCurrentlyCollapsed = collapsedRows[creneauId] ?? true;
    setCollapsedRows((current) => ({
      ...current,
      [creneauId]: !isCurrentlyCollapsed,
    }));
  };

  const handleSave = async () => {
    const shouldSave = window.confirm(
      "Ce bouton va remplacer tout l'emploi du temps de la classe selectionnee pour l'annee scolaire en cours. Continuer ?",
    );

    if (!shouldSave) return;

    const result = await savePlanning();
    info(result.message, result.success ? "success" : "error");
  };

  if (!etablissement_id) {
    return (
      <EmptyState
        title="Session incomplete"
        description="Connecte-toi a un etablissement pour planifier un emploi du temps global."
      />
    );
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-10 shadow-sm">
        <Spin label="Chargement du tableau de bord..." showLabel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.32),_transparent_34%),linear-gradient(135deg,_#0f172a_0%,_#0f766e_45%,_#155e75_100%)] px-6 py-7 text-white shadow-[0_28px_80px_-32px_rgba(15,23,42,0.9)] sm:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.08)_35%,transparent_70%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
                <FiCalendar />
                Planification annuelle
              </div>
              <div className="group relative">
                <button
                  type="button"
                  aria-label="Informations sur la planification"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
                >
                  <FiInfo />
                </button>
                <div className="pointer-events-none absolute left-0 top-12 z-30 hidden w-80 rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-left text-sm leading-6 text-slate-200 shadow-2xl backdrop-blur group-hover:block group-focus-within:block">
                  Chaque creneau enregistre ici reste actif sur toute l'annee
                  scolaire courante. Charge un emploi du temps existant, ajuste les
                  matieres, puis republie tout le planning global en cas de changement.
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Planning hebdomadaire de classe
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
              Organise, ajuste et republie la semaine type d'une classe depuis une
              seule interface.
            </p>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-white/15 bg-slate-950/25 p-4 backdrop-blur sm:min-w-[320px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
                Annee scolaire
              </p>
              <p className="mt-1 text-lg font-semibold">
                {currentYear?.nom ?? "Non definie"}
              </p>
              <p className="mt-1 text-sm text-slate-200">
                {formatShortDate(currentYear?.date_debut)} -{" "}
                {formatShortDate(currentYear?.date_fin)}
              </p>
            </div>

            <div className="h-px bg-white/10" />

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
                Classe active
              </p>
              <p className="mt-1 text-lg font-semibold">
                {selectedClasse?.nom ?? "Aucune classe"}
              </p>
              <p className="mt-1 text-sm text-slate-200">
                {selectedClasse?.site?.nom
                  ? `${selectedClasse.site.nom} - ${selectedClasse?.niveau?.nom ?? "Niveau non precise"}`
                  : selectedClasse?.niveau?.nom ?? "Selectionne une classe pour commencer"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          icon={<FiLayers />}
          label="Creneaux planifies"
          value={`${plannedSlots}/${totalSlots || 0}`}
          accent="bg-emerald-100 text-emerald-700"
          helper="Vue immediate du remplissage de la semaine type."
        />
        <StatCard
          icon={<FiBookOpen />}
          label="Matieres a placer"
          value={courses.length}
          accent="bg-cyan-100 text-cyan-700"
          helper="Cours disponibles pour construire la grille."
        />
        <StatCard
          icon={<FiClock />}
          label="Cours sans creneau"
          value={unplannedCourses}
          accent="bg-amber-100 text-amber-700"
          helper="Cours encore absents de la planification."
        />
        <StatCard
          icon={<FiUsers />}
          label="Salles mobilisees"
          value={assignedRooms}
          accent="bg-slate-200 text-slate-700"
          helper="Nombre de salles deja affectees cette semaine."
        />
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_340px]">
        <div className="min-w-0 space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,280px)_minmax(180px,1fr)] xl:items-end">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Classe a planifier
                  </span>
                  <select
                    value={selectedClasseId}
                    onChange={(event) => {
                      void selectClasse(event.target.value);
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                    disabled={loadingPlanning || saving || classes.length === 0}
                  >
                    <option value="">Choisir une classe</option>
                    {classes.map((classe) => (
                      <option key={classe.id} value={classe.id}>
                        {classe.nom}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Portee
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    Recurrence hebdomadaire
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Les creneaux restent actifs entre{" "}
                    {formatShortDate(currentYear?.date_debut)} et{" "}
                    {formatShortDate(currentYear?.date_fin)}.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => selectedClasseId && void selectClasse(selectedClasseId)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!selectedClasseId || loadingPlanning || saving}
                >
                  <FiRefreshCw />
                  Recharger
                </button>
                <button
                  type="button"
                  onClick={resetFromExisting}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!selectedClasseId || loadingPlanning || saving}
                >
                  <FiRotateCcw />
                  Revenir au dernier planning
                </button>
                <button
                  type="button"
                  onClick={clearPlanner}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loadingPlanning || saving || plannedSlots === 0}
                >
                  <FiTrash2 />
                  Vider la grille
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!selectedClasseId || loadingPlanning || saving}
                >
                  {saving ? <Spin inline /> : <FiSave />}
                  Enregistrer le planning annuel
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <FiCheck />
                Semaine type recurrente
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700">
                Selectionne un cours puis une salle
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                <FiMapPin />
                Sauvegarde globale par classe
              </div>
            </div>
          </div>

          <SectionCard
            title="Grille hebdomadaire"
            description="Une case configuree devient un creneau recurrent pour toute l'annee scolaire."
            action={
              loadingPlanning ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Spin inline />
                  Chargement...
                </div>
              ) : null
            }
          >
            {!selectedClasseId ? (
              <EmptyState
                title="Choisir une classe"
                description="Des que la classe est selectionnee, on charge ses cours, ses salles et son planning global pour edition."
              />
            ) : creneaux.length === 0 ? (
              <EmptyState
                title="Aucun creneau horaire"
                description="Commence par configurer les creneaux horaires dans le menu Parametre pour planifier la grille."
              />
            ) : courses.length === 0 && !loadingPlanning ? (
              <EmptyState
                title="Aucun cours trouve"
                description="La classe selectionnee n'a pas encore de cours relies sur l'annee scolaire active."
              />
            ) : (
              <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_40%,_#f0fdf4_100%)] p-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  {visibleDays.map((day) => (
                    <div
                      key={`summary-${day.value}`}
                      className="rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
                    >
                      {day.label}: {plannedByDay[day.value] ?? 0}/{creneaux.length}
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[1140px]">
                  <div className="grid grid-cols-[220px_repeat(6,minmax(0,1fr))] gap-3">
                    <div className="sticky left-0 z-20 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-700 backdrop-blur">
                      Creneaux
                    </div>
                    {visibleDays.map((day) => (
                      <div
                        key={day.value}
                        className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-800">
                            {day.label}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                            {plannedByDay[day.value] ?? 0}/{creneaux.length}
                          </span>
                        </div>
                      </div>
                    ))}

                    {creneaux.map((creneau) => (
                      <Fragment key={creneau.id}>
                        <div className="sticky left-0 z-10 rounded-[24px] border border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {creneau.nom}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {creneau.heure_debut} - {creneau.heure_fin}
                              </p>
                              <div className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                                {plannedByCreneau[creneau.id] ?? 0}/{visibleDays.length} jours
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleRow(creneau.id)}
                              aria-label={
                                collapsedRows[creneau.id]
                                  ? `Developper ${creneau.nom}`
                                  : `Reduire ${creneau.nom}`
                              }
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                            >
                              {collapsedRows[creneau.id] ? (
                                <FiChevronRight />
                              ) : (
                                <FiChevronDown />
                              )}
                            </button>
                          </div>
                        </div>
                        {visibleDays.map((day) => {
                          const cellKey = getPlannerCellKey(day.value, creneau.id);
                          const cell = planner[cellKey];
                          const selectedCourse = selectedCourseByCell[cellKey];
                          const isCollapsed = collapsedRows[creneau.id] ?? true;

                          return (
                            <div
                              key={cellKey}
                              className={`group rounded-[24px] border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                                cell?.cours_id
                                  ? "border-emerald-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f0fdf4_100%)] hover:border-emerald-300"
                                  : "border-slate-200 bg-white/90 hover:border-cyan-300"
                              } ${isCollapsed ? "p-2.5" : "p-3"}`}
                            >
                              {isCollapsed ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                      {day.label}
                                    </span>
                                    {cell?.cours_id ? (
                                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                        Actif
                                      </span>
                                    ) : null}
                                  </div>
                                  {selectedCourse ? (
                                    <div className="rounded-2xl bg-white/80 px-3 py-2">
                                      <p className="truncate text-sm font-semibold text-slate-900">
                                        {selectedCourse.matiere?.nom ?? "Matiere"}
                                      </p>
                                      <p className="mt-1 truncate text-[11px] text-slate-500">
                                        {getTeacherDisplayLabel(selectedCourse.enseignant)}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-500">
                                      Aucun cours
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <label className="block">
                                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Matiere / cours
                                    </span>
                                    <select
                                      value={cell?.cours_id ?? ""}
                                      onChange={(event) =>
                                        updatePlannerCell(day.value, creneau.id, {
                                          cours_id: event.target.value || undefined,
                                        })
                                      }
                                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                                      disabled={loadingPlanning || saving}
                                    >
                                      <option value="">Aucun cours</option>
                                      {courses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                          {getCourseLabel(course)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  {selectedCourse ? (
                                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-white/80 px-3 py-3">
                                      <p className="text-sm font-semibold text-slate-900">
                                        {selectedCourse.matiere?.nom ?? "Matiere"}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-600">
                                        {getTeacherDisplayLabel(selectedCourse.enseignant)}
                                      </p>
                                      {getTeacherSecondaryLabel(selectedCourse.enseignant) ? (
                                        <p className="mt-1 text-[11px] text-slate-500">
                                          {getTeacherSecondaryLabel(selectedCourse.enseignant)}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <label className="mt-3 block">
                                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      Salle
                                    </span>
                                    <select
                                      value={cell?.salle_id ?? ""}
                                      onChange={(event) =>
                                        updatePlannerCell(day.value, creneau.id, {
                                          salle_id: event.target.value || undefined,
                                        })
                                      }
                                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                                      disabled={loadingPlanning || saving || !cell?.cours_id}
                                    >
                                      <option value="">Salle non definie</option>
                                      {salles.map((room) => (
                                        <option key={room.id} value={room.id}>
                                          {getRoomLabel(room)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  {cell?.cours_id ? (
                                    <div className="mt-3 space-y-2">
                                      <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                        Repete chaque {day.label.toLowerCase()} sur tout l'exercice.
                                      </div>
                                      {cell?.salle_id && roomById[cell.salle_id] ? (
                                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                                          <FiMapPin />
                                          {getRoomLabel(roomById[cell.salle_id])}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-500">
                                      Laisse vide si aucun cours n'est prevu.
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
              </div>
            )}
          </SectionCard>
        </div>

        <aside className="min-w-0 space-y-6 2xl:sticky 2xl:top-6 2xl:self-start">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                <FiCheckCircle />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Pilotage global
                </h3>
                <p className="text-sm text-slate-500">
                  Un resume rapide pour verifier l'equilibre du planning.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Couverture de grille
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {totalSlots === 0 ? "0%" : `${Math.round((plannedSlots / totalSlots) * 100)}%`}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Cadence
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Semaine type vers annee scolaire
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Chaque creneau porte ses dates d'effet sur l'annee active.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Action globale
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Sauvegarde = remplacement complet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Pratique pour replanifier toute la classe lors d'un changement.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Courses de la classe
                </h3>
                <p className="text-sm text-slate-500">
                  Verifie vite les matieres deja placees ou encore en attente.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {courses.length} cours
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {courses.length === 0 ? (
                <EmptyState
                  title="Pas encore de cours"
                  description="Ajoute d'abord les cours de la classe pour pouvoir les repartir dans la grille."
                />
              ) : (
                courses.map((course) => {
                  const usage = courseUsageById[course.id] ?? 0;

                  return (
                    <div
                      key={course.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {course.matiere?.nom ?? "Matiere sans nom"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getTeacherDisplayLabel(course.enseignant)}
                          </p>
                          {getTeacherSecondaryLabel(course.enseignant) ? (
                            <p className="mt-1 text-[11px] text-slate-400">
                              {getTeacherSecondaryLabel(course.enseignant)}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            usage > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {usage > 0 ? `${usage} creneau(x)` : "A placer"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
