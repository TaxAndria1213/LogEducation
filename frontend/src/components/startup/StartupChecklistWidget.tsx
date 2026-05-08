import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FiBookOpen,
  FiChevronDown,
  FiChevronUp,
  FiCreditCard,
  FiLayers,
  FiRefreshCw,
  FiSettings,
  FiUsers,
} from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import InitialisationEtablissementService from "../../services/initialisationEtablissement.service";
import EnseignantService from "../../services/enseignant.service";
import PeriodeService from "../../services/periode.service";
import ProgrammeService from "../../services/programme.service";
import CoursService from "../../services/cours.service";
import RegleNoteService from "../../services/regleNote.service";
import type { InitialisationStatus } from "../../pages/etablissement/initialisation/types";

type ChecklistTask = {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
  done: boolean;
};

type ChecklistSnapshot = {
  status: InitialisationStatus | null;
  teacherCount: number;
  periodCount: number;
  programmeCount: number;
  courseCount: number;
  noteRuleCount: number;
};

const STORAGE_KEY = "logesco.startup-checklist.collapsed";

function getStoredCollapsedState() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setStoredCollapsedState(value: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    return;
  }
}

function getMetaTotal(result: unknown) {
  if (
    typeof result === "object" &&
    result !== null &&
    "data" in result &&
    typeof result.data === "object" &&
    result.data !== null &&
    "meta" in result.data &&
    typeof result.data.meta === "object" &&
    result.data.meta !== null &&
    "total" in result.data.meta &&
    typeof result.data.meta.total === "number"
  ) {
    return result.data.meta.total;
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "data" in result &&
    typeof result.data === "object" &&
    result.data !== null &&
    "data" in result.data &&
    Array.isArray(result.data.data)
  ) {
    return result.data.data.length;
  }

  return 0;
}

function StartupChecklistWidget() {
  const { etablissement_id } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(getStoredCollapsedState);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [snapshot, setSnapshot] = useState<ChecklistSnapshot | null>(null);

  const loadChecklist = useCallback(async () => {
    if (!etablissement_id) {
      setSnapshot(null);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const enseignantService = new EnseignantService();
      const programmeService = new ProgrammeService();
      const coursService = new CoursService();
      const regleNoteService = new RegleNoteService();

      const statusResponse = await InitialisationEtablissementService.getStatus(
        etablissement_id,
      );

      const status = (statusResponse.data ?? null) as InitialisationStatus | null;
      const activeYearId = status?.active_year?.id ?? null;

      const [
        teachersResponse,
        periodesResponse,
        programmesResponse,
        coursResponse,
        reglesResponse,
      ] = await Promise.all([
        enseignantService.getAll({
          page: 1,
          take: 1,
          where: JSON.stringify({ personnel: { etablissement_id } }),
        }),
        activeYearId
          ? PeriodeService.getAll({
              page: 1,
              take: 1,
              where: JSON.stringify({ annee_scolaire_id: activeYearId }),
            })
          : Promise.resolve(null),
        programmeService.getForEtablissement(etablissement_id, {
          page: 1,
          take: 1,
          where: activeYearId ? { annee_scolaire_id: activeYearId } : undefined,
        }),
        coursService.getForEtablissement(etablissement_id, {
          page: 1,
          take: 1,
          where: activeYearId ? { annee_scolaire_id: activeYearId } : undefined,
        }),
        regleNoteService.getAll({
          page: 1,
          take: 1,
          where: JSON.stringify({ etablissement_id }),
        }),
      ]);

      setSnapshot({
        status,
        teacherCount: getMetaTotal(teachersResponse),
        periodCount: getMetaTotal(periodesResponse),
        programmeCount: getMetaTotal(programmesResponse),
        courseCount: getMetaTotal(coursResponse),
        noteRuleCount: getMetaTotal(reglesResponse),
      });
    } catch (error) {
      console.warn(
        "Impossible de charger le raccourci d'initialisation d'etablissement.",
        error,
      );
      setErrorMessage("Raccourci d'initialisation indisponible.");
    } finally {
      setLoading(false);
    }
  }, [etablissement_id]);

  useEffect(() => {
    void loadChecklist();
  }, [loadChecklist, location.pathname]);

  useEffect(() => {
    const handleFocus = () => {
      void loadChecklist();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadChecklist]);

  const tasks = useMemo<ChecklistTask[]>(() => {
    const status = snapshot?.status;
    const pedagogieReady =
      Boolean(status?.active_year?.id) &&
      (snapshot?.periodCount ?? 0) > 0 &&
      (status?.counts.matieres ?? 0) > 0 &&
      (snapshot?.programmeCount ?? 0) > 0 &&
      (snapshot?.courseCount ?? 0) > 0 &&
      (snapshot?.noteRuleCount ?? 0) > 0;

    return [
      {
        key: "etablissement",
        title: "Initialisation de l'etablissement",
        description: "Finalise le socle global: site, annee active, niveaux, classes et securite.",
        path: "/etablissement/initialisation",
        icon: <FiSettings />,
        done: Boolean(status?.ready_for_operational_start),
      },
      {
        key: "enseignants",
        title: "Enregistrement des enseignants",
        description: "Ajoute les enseignants qui porteront les cours, les evaluations et les notes.",
        path: "/personnel/enseignants",
        icon: <FiUsers />,
        done: (snapshot?.teacherCount ?? 0) > 0,
      },
      {
        key: "pedagogie",
        title: "Initialisation pedagogique",
        description: "Prepare periodes, matieres, programmes, cours et regles de notes sur l'annee courante.",
        path: "/pedagogie/initialisation",
        icon: <FiBookOpen />,
        done: pedagogieReady,
      },
      {
        key: "departements",
        title: "Departements pedagogiques",
        description: "Structure les equipes par departement pour mieux organiser les matieres et enseignants.",
        path: "/personnel/departements",
        icon: <FiLayers />,
        done: (status?.counts.departements ?? 0) > 0,
      },
      {
        key: "finance",
        title: "Catalogue de frais",
        description: "Configure les frais de base pour rendre les inscriptions et la facturation pleinement exploitables.",
        path: "/finance/catalogue_frais",
        icon: <FiCreditCard />,
        done: (status?.counts.catalogue_frais ?? 0) > 0,
      },
    ];
  }, [snapshot]);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => !task.done),
    [tasks],
  );

  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round(((tasks.length - pendingTasks.length) / tasks.length) * 100);
  }, [pendingTasks.length, tasks.length]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      setStoredCollapsedState(next);
      return next;
    });
  };

  if (!etablissement_id) return null;
  if (!loading && !errorMessage && pendingTasks.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-50"
    >
      <div className="pointer-events-auto max-w-[calc(100vw-2rem)]">
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_18px_38px_rgba(15,23,42,0.16)] transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <FiSettings />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                Demarrage etablissement
              </span>
              <span className="block text-xs text-slate-500">
                {loading ? "Chargement..." : `${pendingTasks.length} action(s) restante(s)`}
              </span>
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {pendingTasks.length}
            </span>
          </button>
        ) : (
          <section className="flex max-h-[calc(100vh-2.5rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
            <div className="shrink-0 border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_45%,#f8fafc_100%)] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Raccourci prioritaire
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">
                    Demarrage de l'etablissement
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    On ne garde ici que les actions encore utiles pour arriver a un fonctionnement complet.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Reduire le raccourci d'initialisation"
                >
                  <FiChevronDown />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Avancement
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {progress}%
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadChecklist()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FiRefreshCw />
                  Recharger
                </button>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#0ea5e9_100%)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Chargement des verifications...
                </div>
              ) : errorMessage ? (
                <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                  {errorMessage}
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.map((task) => (
                    <article
                      key={task.key}
                      className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                          {task.icon}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {task.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {task.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(task.path)}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <span>Ouvrir</span>
                        <FiChevronUp className="rotate-90" />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default StartupChecklistWidget;
