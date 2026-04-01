import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiClock,
  FiLogIn,
  FiRefreshCw,
  FiSettings,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import InscriptionService from "../../../../../services/inscription.service";
import type { AnneeScolaire, Inscription, StatutInscription } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
  onNouvelleInscription?: () => void;
  onReinscription?: () => void;
};

type InscriptionRecord = Inscription & {
  eleve?: {
    code_eleve?: string | null;
  } | null;
  classe?: {
    nom?: string | null;
  } | null;
  annee?: {
    nom?: string | null;
    est_active?: boolean;
  } | null;
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

  return "Impossible de charger les inscriptions.";
}

function getStatusLabel(status: StatutInscription) {
  switch (status) {
    case "INSCRIT":
      return "Inscrit";
    case "TRANSFERE":
      return "Transfere";
    case "SORTI":
      return "Sorti";
    default:
      return status;
  }
}

function getStatusClasses(status: StatutInscription) {
  switch (status) {
    case "INSCRIT":
      return "bg-emerald-50 text-emerald-700";
    case "TRANSFERE":
      return "bg-amber-50 text-amber-700";
    case "SORTI":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function InscriptionDashboard({
  mode = "overview",
  onNouvelleInscription,
  onReinscription,
}: Props) {
  const { etablissement_id } = useAuth();
  const [inscriptions, setInscriptions] = useState<InscriptionRecord[]>([]);
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setInscriptions([]);
        setCurrentYear(null);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new InscriptionService();
        const [inscriptionResult, activeYear] = await Promise.all([
          service.getAll({
            page: 1,
            take: 400,
            includeSpec: JSON.stringify({
              eleve: true,
              classe: true,
              annee: true,
            }),
            where: JSON.stringify({
              annee: {
                etablissement_id,
              },
            }),
            orderBy: JSON.stringify([{ date_inscription: "desc" }]),
          }),
          AnneeScolaireService.getCurrent(etablissement_id),
        ]);

        if (!active) return;

        setInscriptions(
          inscriptionResult?.status.success
            ? ((inscriptionResult.data.data as InscriptionRecord[]) ?? [])
            : [],
        );
        setCurrentYear((activeYear as AnneeScolaire | null) ?? null);
      } catch (error: unknown) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const currentYearInscriptions = useMemo(() => {
    if (!currentYear?.id) {
      return inscriptions;
    }

    return inscriptions.filter(
      (inscription) => inscription.annee_scolaire_id === currentYear.id,
    );
  }, [currentYear, inscriptions]);

  const coveredStudents = useMemo(
    () => new Set(currentYearInscriptions.map((inscription) => inscription.eleve_id)).size,
    [currentYearInscriptions],
  );
  const coveredClasses = useMemo(
    () => new Set(currentYearInscriptions.map((inscription) => inscription.classe_id)).size,
    [currentYearInscriptions],
  );
  const transferredCount = useMemo(
    () =>
      currentYearInscriptions.filter((inscription) => inscription.statut === "TRANSFERE")
        .length,
    [currentYearInscriptions],
  );
  const exitedCount = useMemo(
    () => currentYearInscriptions.filter((inscription) => inscription.statut === "SORTI").length,
    [currentYearInscriptions],
  );
  const activeCount = useMemo(
    () => currentYearInscriptions.filter((inscription) => inscription.statut === "INSCRIT").length,
    [currentYearInscriptions],
  );
  const coverageRate = useMemo(() => {
    if (currentYearInscriptions.length === 0) {
      return 0;
    }

    return Math.round((activeCount / currentYearInscriptions.length) * 100);
  }, [activeCount, currentYearInscriptions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {currentYear ? (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              <FiClock />
              Annee active: {currentYear.nom}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Aucune annee scolaire active n'a ete detectee pour cet etablissement.
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {loading ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Chargement...
            </span>
          ) : null}
          {mode === "overview" ? (
            <>
              <button
                onClick={onNouvelleInscription}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                type="button"
              >
                Nouvelle inscription
              </button>
              <button
                onClick={onReinscription}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                type="button"
              >
                Reinscription
              </button>
            </>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLogIn />
            <span className="text-sm font-medium">Inscriptions de l'annee</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {currentYearInscriptions.length}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Eleves couverts</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{coveredStudents}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiBookOpen />
            <span className="text-sm font-medium">Classes concernees</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{coveredClasses}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiTrendingUp />
            <span className="text-sm font-medium">Dossiers actifs</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{coverageRate}%</p>
        </div>
      </section>

      {mode === "settings" ? null : (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Inscriptions recentes
              </h3>
              <p className="text-sm text-slate-500">
                Les derniers dossiers enregistres sur l'annee active.
              </p>
            </div>

            {currentYearInscriptions.length > 0 ? (
              <div className="mt-5 space-y-3">
                {currentYearInscriptions.slice(0, 6).map((inscription) => {
                  const formattedDate = formatDateWithLocalTimezone(
                    inscription.date_inscription.toString(),
                  );

                  return (
                    <article
                      key={inscription.id}
                      className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-slate-900">
                            {inscription.eleve?.code_eleve ?? "Code non renseigne"}
                          </h4>
                          <p className="mt-1 text-sm text-slate-500">
                            Classe: {inscription.classe?.nom ?? "Non renseignee"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(inscription.statut)}`}
                        >
                          {getStatusLabel(inscription.statut)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">
                        Inscrit le {formattedDate.date}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucune inscription n'est encore disponible pour l'annee active.
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Mouvements a suivre</h3>
              <p className="text-sm text-slate-500">
                Lecture rapide des statuts qui ont un impact sur les effectifs.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-600">Inscrits</span>
                  <span className="text-xl font-semibold text-slate-900">{activeCount}</span>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-600">Transferes</span>
                  <span className="text-xl font-semibold text-slate-900">
                    {transferredCount}
                  </span>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-600">Sortis</span>
                  <span className="text-xl font-semibold text-slate-900">{exitedCount}</span>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-3 text-slate-500">
                  <FiRefreshCw />
                  <p className="text-sm leading-6 text-slate-600">
                    Les actions de reinscription et de nouvelle inscription restent
                    disponibles depuis cette page d'accueil.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default InscriptionDashboard;

