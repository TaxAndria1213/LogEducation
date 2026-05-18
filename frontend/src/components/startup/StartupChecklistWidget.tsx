import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FiBookOpen,
  FiChevronDown,
  FiChevronUp,
  FiCreditCard,
  FiRefreshCw,
  FiSettings,
  FiUsers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { hasAccess } from "../components.build";
import InitialisationEtablissementService from "../../services/initialisationEtablissement.service";
import EnseignantService from "../../services/enseignant.service";
import PeriodeService from "../../services/periode.service";
import ProgrammeService from "../../services/programme.service";
import CoursService from "../../services/cours.service";
import RegleNoteService from "../../services/regleNote.service";
import type { InitialisationStatus } from "../../pages/etablissement/initialisation/types";
import type { componentId } from "../../types/types";
import { STARTUP_CHECKLIST_REFRESH_EVENT } from "./startupChecklistEvents";

type ChecklistTask = {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
  done: boolean;
  permissions?: componentId[];
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
const CACHE_TTL_MS = 2 * 60 * 1000;
const checklistSnapshotCache = new Map<
  string,
  { snapshot: ChecklistSnapshot; loadedAt: number }
>();

function getCollapsedStorageKey(etablissementId?: string | null) {
  return etablissementId ? `${STORAGE_KEY}.${etablissementId}` : STORAGE_KEY;
}

function getStoredCollapsedState(etablissementId?: string | null) {
  if (typeof window === "undefined") return false;

  try {
    const scopedValue = window.localStorage.getItem(
      getCollapsedStorageKey(etablissementId),
    );
    if (scopedValue != null) return scopedValue === "true";
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setStoredCollapsedState(
  value: boolean,
  etablissementId?: string | null,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getCollapsedStorageKey(etablissementId),
      value ? "true" : "false",
    );
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

  if (
    typeof result === "object" &&
    result !== null &&
    "data" in result &&
    Array.isArray(result.data)
  ) {
    return result.data.length;
  }

  return 0;
}

async function readOptionalCount(label: string, request: Promise<unknown>) {
  try {
    return getMetaTotal(await request);
  } catch (error) {
    console.warn(
      `Verification du raccourci d'initialisation ignoree (${label}).`,
      error,
    );
    return 0;
  }
}

function StartupChecklistWidget() {
  const { etablissement_id, roles, user } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => getStoredCollapsedState());
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [snapshot, setSnapshot] = useState<ChecklistSnapshot | null>(null);

  const canAccessShortcut = useMemo(
    () =>
      Boolean(
        user &&
          roles &&
          hasAccess(user, roles, "ET.INIT.MENUACTION"),
      ),
    [roles, user],
  );

  const hasAnyPermission = useCallback(
    (permissions?: componentId[]) => {
      if (!permissions || permissions.length === 0) return true;
      if (!user || !roles) return false;
      return permissions.some((permission) => hasAccess(user, roles, permission));
    },
    [roles, user],
  );

  const loadChecklist = useCallback(async (options?: { force?: boolean }) => {
    if (!etablissement_id || !canAccessShortcut) {
      setSnapshot(null);
      return;
    }

    if (!options?.force) {
      const cachedEntry = checklistSnapshotCache.get(etablissement_id);
      if (cachedEntry && Date.now() - cachedEntry.loadedAt < CACHE_TTL_MS) {
        setSnapshot(cachedEntry.snapshot);
        setErrorMessage("");
        return;
      }
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
      const canCheckTeachers = hasAnyPermission(["PE.ENSEIGNANTS.MENUACTION"]);
      const canCheckPedagogy = hasAnyPermission([
        "PD.PROGRAMMES.MENUACTION",
        "PD.COURS.MENUACTION",
        "PD.REGLESNOTES.MENUACTION",
      ]);

      const [
        teacherCount,
        periodCount,
        programmeCount,
        courseCount,
        noteRuleCount,
      ] = await Promise.all([
        canCheckTeachers
          ? readOptionalCount(
              "enseignants",
              enseignantService.getAll({
                page: 1,
                take: 1,
                where: JSON.stringify({ personnel: { etablissement_id } }),
              }),
            )
          : Promise.resolve(0),
        canCheckPedagogy && activeYearId
          ? readOptionalCount(
              "periodes",
              PeriodeService.getAll({
                page: 1,
                take: 1,
                where: JSON.stringify({ annee_scolaire_id: activeYearId }),
              }),
            )
          : Promise.resolve(0),
        canCheckPedagogy
          ? readOptionalCount(
              "programmes",
              programmeService.getForEtablissement(etablissement_id, {
                page: 1,
                take: 1,
                where: activeYearId
                  ? { annee_scolaire_id: activeYearId }
                  : undefined,
              }),
            )
          : Promise.resolve(0),
        canCheckPedagogy
          ? readOptionalCount(
              "cours",
              coursService.getForEtablissement(etablissement_id, {
                page: 1,
                take: 1,
                where: activeYearId
                  ? { annee_scolaire_id: activeYearId }
                  : undefined,
              }),
            )
          : Promise.resolve(0),
        canCheckPedagogy
          ? readOptionalCount(
              "regles de notes",
              regleNoteService.getAll({
                page: 1,
                take: 1,
                where: JSON.stringify({ etablissement_id }),
              }),
            )
          : Promise.resolve(0),
      ]);

      const nextSnapshot = {
        status,
        teacherCount,
        periodCount,
        programmeCount,
        courseCount,
        noteRuleCount,
      };

      checklistSnapshotCache.set(etablissement_id, {
        snapshot: nextSnapshot,
        loadedAt: Date.now(),
      });
      setSnapshot(nextSnapshot);
    } catch (error) {
      console.warn(
        "Impossible de charger le raccourci d'initialisation d'etablissement.",
        error,
      );
      setErrorMessage("Raccourci d'initialisation indisponible.");
    } finally {
      setLoading(false);
    }
  }, [canAccessShortcut, etablissement_id, hasAnyPermission]);

  useEffect(() => {
    void loadChecklist();
  }, [loadChecklist]);

  useEffect(() => {
    setCollapsed(getStoredCollapsedState(etablissement_id));
  }, [etablissement_id]);

  useEffect(() => {
    const handleFocus = () => {
      void loadChecklist({ force: true });
    };
    const handleRefreshRequest = () => {
      void loadChecklist({ force: true });
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener(
      STARTUP_CHECKLIST_REFRESH_EVENT,
      handleRefreshRequest,
    );

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(
        STARTUP_CHECKLIST_REFRESH_EVENT,
        handleRefreshRequest,
      );
    };
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
        permissions: ["ET.INIT.MENUACTION"],
      },
      {
        key: "enseignants",
        title: "Enregistrement des enseignants",
        description: "Ajoute les enseignants qui porteront les cours, les evaluations et les notes.",
        path: "/personnel/enseignants",
        icon: <FiUsers />,
        done: (snapshot?.teacherCount ?? 0) > 0,
        permissions: ["PE.ENSEIGNANTS.MENUACTION"],
      },
      {
        key: "pedagogie",
        title: "Initialisation pedagogique",
        description: "Prepare periodes, matieres, programmes, cours et regles de notes sur l'annee courante.",
        path: "/pedagogie/initialisation",
        icon: <FiBookOpen />,
        done: pedagogieReady,
        permissions: [
          "PD.PROGRAMMES.MENUACTION",
          "PD.COURS.MENUACTION",
          "PD.REGLESNOTES.MENUACTION",
        ],
      },
      {
        key: "finance",
        title: "Catalogue de frais",
        description: "Configure les frais de base pour rendre les inscriptions et la facturation pleinement exploitables.",
        path: "/finance/catalogue_frais",
        icon: <FiCreditCard />,
        done: (status?.counts.catalogue_frais ?? 0) > 0,
        permissions: ["FIN.CATALOGUEFRAIS.MENUACTION"],
      },
    ];
  }, [snapshot]);

  const pendingTasks = useMemo(
    () =>
      tasks.filter((task) => !task.done && hasAnyPermission(task.permissions)),
    [hasAnyPermission, tasks],
  );

  const progress = useMemo(() => {
    const accessibleTasks = tasks.filter((task) =>
      hasAnyPermission(task.permissions),
    );
    if (accessibleTasks.length === 0) return 0;
    const doneCount = accessibleTasks.filter((task) => task.done).length;
    return Math.round((doneCount / accessibleTasks.length) * 100);
  }, [hasAnyPermission, tasks]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      setStoredCollapsedState(next, etablissement_id);
      return next;
    });
  };

  if (!etablissement_id || !canAccessShortcut) return null;
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
                  onClick={() => void loadChecklist({ force: true })}
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
