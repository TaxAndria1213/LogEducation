import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCheckCircle,
  FiClock,
  FiSettings,
  FiUser,
  FiUserCheck,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import EleveService from "../../../../../services/eleve.service";
import InscriptionService from "../../../../../services/inscription.service";
import type { AnneeScolaire, Eleve } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

type EleveRecord = Eleve & {
  utilisateur?: {
    profil?: {
      prenom?: string | null;
      nom?: string | null;
    } | null;
  } | null;
};

function formatDate(value?: Date | string | null) {
  if (!value) return "Non renseignee";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseignee";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getFullName(eleve: EleveRecord) {
  const prenom = eleve.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = eleve.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = `${prenom} ${nom}`.trim();
  return fullName || "Profil non renseigne";
}

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

  return "Impossible de charger les informations des eleves.";
}

function EleveOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [eleves, setEleves] = useState<EleveRecord[]>([]);
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [currentYearRegistrations, setCurrentYearRegistrations] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setEleves([]);
        setCurrentYear(null);
        setCurrentYearRegistrations(0);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const eleveService = new EleveService();
        const inscriptionService = new InscriptionService();

        const [elevesResult, activeYear] = await Promise.all([
          eleveService.getAll({
            page: 1,
            take: 500,
            includeSpec: JSON.stringify({
              utilisateur: {
                include: {
                  profil: true,
                },
              },
            }),
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ created_at: "desc" }]),
          }),
          AnneeScolaireService.getCurrent(etablissement_id),
        ]);

        if (!active) return;

        setEleves(
          elevesResult?.status.success
            ? ((elevesResult.data.data as EleveRecord[]) ?? [])
            : [],
        );
        setCurrentYear((activeYear as AnneeScolaire | null) ?? null);

        if (activeYear?.id) {
          const registrationCount =
            (await inscriptionService.getStudentRegisteredNumberThisYear(activeYear.id)) ?? 0;

          if (!active) return;
          setCurrentYearRegistrations(registrationCount);
        } else {
          setCurrentYearRegistrations(0);
        }
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

  const activeStudents = useMemo(
    () =>
      eleves.filter((eleve) => (eleve.statut ?? "").toUpperCase() === "ACTIF").length,
    [eleves],
  );
  const studentsWithAccount = useMemo(
    () => eleves.filter((eleve) => Boolean(eleve.utilisateur_id)).length,
    [eleves],
  );
  const recentEntries = useMemo(
    () =>
      [...eleves]
        .sort((left, right) => {
          const leftTime = left.date_entree ? new Date(left.date_entree).getTime() : 0;
          const rightTime = right.date_entree ? new Date(right.date_entree).getTime() : 0;
          return rightTime - leftTime;
        })
        .slice(0, 6),
    [eleves],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiUserCheck />
              Suivi des eleves
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les regles utiles pour gerer les dossiers eleves, les comptes lies et le suivi de la scolarite."
                  : "Accueil du module Eleves avec les informations essentielles sur les effectifs de l'etablissement."}
              </p>
            </div>
          </div>
          {loading ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Chargement...
            </span>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUser />
            <span className="text-sm font-medium">Nombre d'eleves</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{eleves.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Eleves actifs</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{activeStudents}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiBookOpen />
            <span className="text-sm font-medium">Inscrits sur l'annee active</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {currentYearRegistrations}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiSettings />
            <span className="text-sm font-medium">Comptes lies</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {studentsWithAccount}
          </p>
        </div>
      </section>

      {mode === "settings" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiSettings />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Parametres du module Eleves
              </h3>
              <p className="text-sm text-slate-500">
                Un dossier eleve propre facilite ensuite les inscriptions, les notes,
                les bulletins et le suivi de presence.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Identite
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Relie chaque eleve a un profil utilisateur quand c'est possible pour
                centraliser le nom, le prenom et les informations personnelles.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Scolarite
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Le dossier eleve doit rester coherent avec l'annee scolaire active,
                les inscriptions en classe et le statut reel de l'eleve.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Eleves recemment arrives
              </h3>
              <p className="text-sm text-slate-500">
                Les dossiers les plus recents ou les plus proches d'une entree en
                etablissement.
              </p>
            </div>

            {recentEntries.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentEntries.map((eleve) => (
                  <div
                    key={eleve.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getFullName(eleve)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Code: {eleve.code_eleve || "Non renseigne"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {eleve.statut || "Statut non renseigne"}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        Entree: {formatDate(eleve.date_entree)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun eleve n'est encore enregistre pour cet etablissement.
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiClock />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Cadre scolaire actif
                </h3>
                <p className="text-sm text-slate-500">
                  Le contexte principal utilise ensuite pour les inscriptions.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Annee scolaire active
                </p>
                <p className="mt-3 text-base font-semibold text-slate-900">
                  {currentYear?.nom ?? "Aucune annee scolaire active"}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Debut: {formatDate(currentYear?.date_debut)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Fin: {formatDate(currentYear?.date_fin)}
                </p>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Points d'attention
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>Verifie les statuts des eleves avant d'ouvrir les inscriptions.</li>
                  <li>Lie les comptes utilisateurs pour fiabiliser l'identite eleve.</li>
                  <li>Utilise l'annee active comme base pour les nouvelles inscriptions.</li>
                </ul>
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

export default EleveOverview;
