import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiArrowRight,
  FiBookOpen,
  FiCalendar,
  FiCreditCard,
  FiLayers,
  FiMapPin,
  FiPlayCircle,
  FiRefreshCw,
  FiSettings,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";
import FlyPopup from "../../../../../components/popup/FlyPopup";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import InitialisationEtablissementService from "../../../../../services/initialisationEtablissement.service";
import type {
  InitialisationSession,
  InitialisationStatus,
  InitialisationTemplates,
} from "../../types";
import InitialisationWizard from "../form/InitialisationWizard";
import NouvelleAnneeWizard from "../form/NouvelleAnneeWizard";
import InitialisationHistoryCard from "./InitialisationHistoryCard";
import InitialisationStatusCard from "./InitialisationStatusCard";

type Props = {
  autoOpenInitialWizard?: boolean;
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

  return "Impossible de charger l'etat d'initialisation.";
}

export default function InitialisationEtablissementOverview({
  autoOpenInitialWizard = false,
}: Props) {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [status, setStatus] = useState<InitialisationStatus | null>(null);
  const [sessions, setSessions] = useState<InitialisationSession[]>([]);
  const [templates, setTemplates] = useState<InitialisationTemplates | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [initialWizardOpen, setInitialWizardOpen] = useState(false);
  const [newYearWizardOpen, setNewYearWizardOpen] = useState(false);
  const [initialWizardHeaderActions, setInitialWizardHeaderActions] =
    useState<ReactNode | null>(null);
  const [newYearWizardHeaderActions, setNewYearWizardHeaderActions] =
    useState<ReactNode | null>(null);
  const initialWizardScrollRef = useRef<HTMLDivElement | null>(null);
  const newYearWizardScrollRef = useRef<HTMLDivElement | null>(null);

  const loadOverview = useCallback(async () => {
    if (!etablissement_id) {
      setStatus(null);
      setSessions([]);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const [statusResponse, sessionsResponse, templatesResponse] =
        await Promise.all([
          InitialisationEtablissementService.getStatus(etablissement_id),
          InitialisationEtablissementService.getSessions(etablissement_id),
          InitialisationEtablissementService.getTemplates(),
        ]);

      setStatus((statusResponse.data ?? null) as InitialisationStatus | null);
      setSessions((sessionsResponse.data as InitialisationSession[]) ?? []);
      setTemplates(
        (templatesResponse.data ?? null) as InitialisationTemplates | null,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [etablissement_id]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (autoOpenInitialWizard) {
      setInitialWizardOpen(true);
    }
  }, [autoOpenInitialWizard]);

  useEffect(() => {
    if (!initialWizardOpen) {
      setInitialWizardHeaderActions(null);
    }
  }, [initialWizardOpen]);

  useEffect(() => {
    if (!newYearWizardOpen) {
      setNewYearWizardHeaderActions(null);
    }
  }, [newYearWizardOpen]);

  const handleCompleted = async () => {
    await loadOverview();
  };

  const scrollInitialWizardToTop = useCallback(() => {
    initialWizardScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollNewYearWizardToTop = useCallback(() => {
    newYearWizardScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const readyModules = useMemo(
    () => [
      {
        label: "Socle etablissement",
        ready: (status?.counts.sites ?? 0) > 0,
        icon: <FiMapPin />,
      },
      {
        label: "Annee active",
        ready: Boolean(status?.active_year),
        icon: <FiCalendar />,
      },
      {
        label: "Niveaux",
        ready: (status?.counts.niveaux ?? 0) > 0,
        icon: <FiLayers />,
      },
      {
        label: "Referentiel matieres",
        ready: (status?.counts.matieres ?? 0) > 0,
        icon: <FiBookOpen />,
      },
      {
        label: "Finance",
        ready: (status?.counts.catalogue_frais ?? 0) > 0,
        icon: <FiCreditCard />,
      },
      {
        label: "Securite",
        ready: (status?.counts.roles ?? 0) > 0,
        icon: <FiShield />,
      },
    ],
    [status],
  );

  if (!etablissement_id) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-600">
        Aucun etablissement actif n'est selectionne pour lancer
        l'initialisation.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-600">
          Chargement de l'etat d'initialisation...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-5 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_45%,#f8fafc_100%)] p-6 shadow-sm">
        <div className="absolute -right-14 top-0 h-44 w-44 rounded-full bg-cyan-100/60 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-amber-100/50 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  status?.ready_for_operational_start
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {status?.ready_for_operational_start
                  ? "Socle operationnel"
                  : "Socle a finaliser"}
              </span>
              <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                {status?.etablissement.nom ?? "Etablissement"}
              </span>
            </div>

            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
              Initialisation guidee de l'etablissement
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Cette vue centralise le demarrage d'un nouvel etablissement et
              l'ouverture d'une nouvelle annee scolaire. Elle garde une lecture
              claire de ce qui est deja en place, de ce qui peut etre genere
              maintenant, et de ce qui reste volontairement differe.
            </p>

            <div className="mt-6 rounded-[24px] border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Progression globale
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {status?.completion_rate ?? 0}%
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm">
                  {status?.active_year?.nom ?? "Aucune annee active"}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0891b2_0%,#14b8a6_100%)] transition-all"
                  style={{ width: `${status?.completion_rate ?? 0}%` }}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setInitialWizardOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <FiPlayCircle />
                Commencer
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!status?.ready_for_new_school_year) {
                    info(
                      "Il faut au moins une annee scolaire de reference pour lancer ce parcours.",
                      "warning",
                    );
                    return;
                  }
                  setNewYearWizardOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <FiRefreshCw />
                Commencer une nouvelle annee scolaire
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            <article className="rounded-[24px] border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Parcours 1
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    Nouvel etablissement
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Site principal, annee initiale, niveaux, classes et socle
                    academique.
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                  <FiTrendingUp />
                </div>
              </div>
            </article>

            <article className="rounded-[24px] border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Parcours 2
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    Nouvelle annee scolaire
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Creation de l'annee cible, reprise des periodes et cadrage
                    des blocs N+1.
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <FiArrowRight />
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InitialisationStatusCard
          title="Progression"
          value={`${status?.completion_rate ?? 0}%`}
          hint="Taux de couverture du socle de demarrage."
          icon={<FiTrendingUp />}
          tone="cyan"
          progress={status?.completion_rate ?? 0}
        />
        <InitialisationStatusCard
          title="Sites"
          value={status?.counts.sites ?? 0}
          hint="Nombre de sites connus pour l'etablissement."
          icon={<FiMapPin />}
          tone="amber"
        />
        <InitialisationStatusCard
          title="Annee active"
          value={status?.active_year?.nom ?? "Aucune"}
          hint="Reference courante utilisee par les modules."
          icon={<FiCalendar />}
          tone="emerald"
        />
        <InitialisationStatusCard
          title="Niveaux"
          value={status?.counts.niveaux ?? 0}
          hint="Niveaux scolaires deja disponibles."
          icon={<FiLayers />}
          tone="rose"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <InitialisationHistoryCard sessions={sessions} />

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Couverture actuelle
              </h3>
              <p className="text-sm text-slate-500">
                Lecture rapide des briques deja stabilisees dans
                l'etablissement.
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiSettings />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {readyModules.map((module) => (
              <div
                key={module.label}
                className="flex items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                      module.ready
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {module.icon}
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    {module.label}
                  </span>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    module.ready
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {module.ready ? "Pret" : "A prevoir"}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Roles
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {status?.counts.roles ?? 0}
              </p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Matieres
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {status?.counts.matieres ?? 0}
              </p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Permissions
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {status?.counts.permissions ?? 0}
              </p>
            </div>
          </div>
        </article>
      </section>

      <FlyPopup
        isOpen={initialWizardOpen}
        setIsOpen={setInitialWizardOpen}
        title="Initialiser un nouvel etablissement"
        headerActions={initialWizardHeaderActions}
        panelClassName="max-w-7xl p-0"
      >
        <div
          ref={initialWizardScrollRef}
          className="max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden p-4 sm:p-6"
        >
          <InitialisationWizard
            etablissementId={etablissement_id}
            templates={templates}
            onClose={() => setInitialWizardOpen(false)}
            onCompleted={() => void handleCompleted()}
            onHeaderActionsChange={setInitialWizardHeaderActions}
            onScrollTopRequest={scrollInitialWizardToTop}
          />
        </div>
      </FlyPopup>

      <FlyPopup
        isOpen={newYearWizardOpen}
        setIsOpen={setNewYearWizardOpen}
        title="Ouvrir une nouvelle annee scolaire"
        headerActions={newYearWizardHeaderActions}
        panelClassName="max-w-6xl p-0"
      >
        <div
          ref={newYearWizardScrollRef}
          className="max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden p-4 sm:p-6"
        >
          <NouvelleAnneeWizard
            etablissementId={etablissement_id}
            status={status}
            onClose={() => setNewYearWizardOpen(false)}
            onCompleted={() => void handleCompleted()}
            onHeaderActionsChange={setNewYearWizardHeaderActions}
            onScrollTopRequest={scrollNewYearWizardToTop}
          />
        </div>
      </FlyPopup>
    </div>
  );
}
