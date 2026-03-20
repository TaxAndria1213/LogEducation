import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiPlayCircle,
  FiSettings,
} from "react-icons/fi";
import { DateField } from "../../../../../components/Form/fields/index";
import { useAuth } from "../../../../../hooks/useAuth";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import type { AnneeScolaire } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

type NewYearFormState = {
  nom: string;
  date_debut: string;
  date_fin: string;
  source_annee_id: string;
  copy_periodes: boolean;
  close_current_year: boolean;
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

function toDateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDurationDays(start?: Date | string | null, end?: Date | string | null) {
  if (!start || !end) return null;
  const left = start instanceof Date ? start : new Date(start);
  const right = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return null;
  const diff = right.getTime() - left.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

function addDays(value?: Date | string | null, days = 0) {
  if (!value) return "";
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function buildNextYearName(activeYear?: AnneeScolaire | null) {
  if (!activeYear?.date_debut || !activeYear?.date_fin) {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 1}`;
  }

  const start = activeYear.date_debut instanceof Date
    ? activeYear.date_debut
    : new Date(activeYear.date_debut);
  const end = activeYear.date_fin instanceof Date
    ? activeYear.date_fin
    : new Date(activeYear.date_fin);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 1}`;
  }

  return `${start.getFullYear() + 1}-${end.getFullYear() + 1}`;
}

function buildInitialFormState(activeYear?: AnneeScolaire | null): NewYearFormState {
  const nextStart = activeYear?.date_fin ? addDays(activeYear.date_fin, 1) : "";
  const duration = getDurationDays(activeYear?.date_debut, activeYear?.date_fin);
  const nextEnd = nextStart && duration ? addDays(nextStart, duration - 1) : "";

  return {
    nom: buildNextYearName(activeYear),
    date_debut: nextStart,
    date_fin: nextEnd,
    source_annee_id: activeYear?.id ?? "",
    copy_periodes: Boolean(activeYear),
    close_current_year: Boolean(activeYear),
  };
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

  return "Une erreur est survenue.";
}

function AnneeScolaireOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const { control, watch, reset } = useForm<{
    date_debut: string;
    date_fin: string;
  }>({
    defaultValues: {
      date_debut: "",
      date_fin: "",
    },
  });
  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [isClosingYear, setIsClosingYear] = useState(false);
  const [isStartingYear, setIsStartingYear] = useState(false);
  const [newYearForm, setNewYearForm] = useState<NewYearFormState>(
    buildInitialFormState(),
  );
  const watchedDateDebut = watch("date_debut");
  const watchedDateFin = watch("date_fin");

  const loadAnnees = async () => {
    if (!etablissement_id) {
      setAnnees([]);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const result = await AnneeScolaireService.getAll({
        page: 1,
        take: 100,
        where: JSON.stringify({ etablissement_id }),
        orderBy: JSON.stringify([{ date_debut: "desc" }]),
      });

      setAnnees(
        result?.status.success ? ((result.data.data as AnneeScolaire[]) ?? []) : [],
      );
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnnees();
  }, [etablissement_id]);

  const activeYear = useMemo(
    () => annees.find((annee) => annee.est_active) ?? null,
    [annees],
  );
  const endedYears = useMemo(
    () => annees.filter((annee) => !annee.est_active).length,
    [annees],
  );
  const previewAnnees = useMemo(() => annees.slice(0, 6), [annees]);
  const activeDurationDays = getDurationDays(activeYear?.date_debut, activeYear?.date_fin);

  useEffect(() => {
    const nextDefaults = buildInitialFormState(activeYear);

    setNewYearForm((current) => {
      return {
        nom: current.nom || nextDefaults.nom,
        date_debut: current.date_debut || nextDefaults.date_debut,
        date_fin: current.date_fin || nextDefaults.date_fin,
        source_annee_id: current.source_annee_id || nextDefaults.source_annee_id,
        copy_periodes: current.source_annee_id ? current.copy_periodes : nextDefaults.copy_periodes,
        close_current_year: nextDefaults.close_current_year,
      };
    });

    reset({
      date_debut: nextDefaults.date_debut,
      date_fin: nextDefaults.date_fin,
    });
  }, [activeYear, reset]);

  useEffect(() => {
    setNewYearForm((current) => ({
      ...current,
      date_debut: watchedDateDebut ?? "",
      date_fin: watchedDateFin ?? "",
    }));
  }, [watchedDateDebut, watchedDateFin]);

  const handleCloseActiveYear = async () => {
    if (!etablissement_id) return;
    if (!activeYear) {
      setErrorMessage("Aucune annee scolaire active n'est disponible pour la cloture.");
      return;
    }

    const confirmed = window.confirm(
      `Cloturer l'annee scolaire ${activeYear.nom} ? Elle ne sera plus l'annee active de l'etablissement.`,
    );

    if (!confirmed) return;

    setIsClosingYear(true);
    setActionMessage("");
    setErrorMessage("");

    try {
      await AnneeScolaireService.closeActive(etablissement_id);
      setActionMessage(`L'annee scolaire ${activeYear.nom} a ete cloturee avec succes.`);
      await loadAnnees();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsClosingYear(false);
    }
  };

  const handleLaunchNewYear = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!etablissement_id) {
      setErrorMessage("Aucun etablissement actif n'est associe a cet utilisateur.");
      return;
    }

    setIsStartingYear(true);
    setActionMessage("");
    setErrorMessage("");

    try {
      await AnneeScolaireService.startNewYear({
        etablissement_id,
        nom: newYearForm.nom,
        date_debut: watchedDateDebut,
        date_fin: watchedDateFin,
        source_annee_id: newYearForm.copy_periodes ? newYearForm.source_annee_id : undefined,
        copy_periodes: newYearForm.copy_periodes,
        close_current_year: newYearForm.close_current_year,
        est_active: true,
      });

      setActionMessage("La nouvelle annee scolaire a ete lancee avec succes.");
      await loadAnnees();
      const nextDefaults = buildInitialFormState(activeYear);
      setNewYearForm(nextDefaults);
      reset({
        date_debut: nextDefaults.date_debut,
        date_fin: nextDefaults.date_fin,
      });
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsStartingYear(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiCalendar />
              Annees scolaires
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les regles utiles pour piloter l'annee scolaire active et l'historique de l'etablissement."
                  : "Vue d'ensemble des annees scolaires rattachees a l'etablissement connecte."}
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

        {actionMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {actionMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCalendar />
            <span className="text-sm font-medium">Nombre d'annees</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{annees.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Annee active</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {activeYear?.nom ?? "Aucune annee active"}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiClock />
            <span className="text-sm font-medium">Duree active</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {activeDurationDays ?? 0}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiSettings />
            <span className="text-sm font-medium">Annees terminees</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{endedYears}</p>
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
                Parametres du module Annee scolaire
              </h3>
              <p className="text-sm text-slate-500">
                Une seule annee scolaire doit rester active pour simplifier la navigation dans les autres modules.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Cloture
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Cloturer une annee la retire du statut actif. Les modules dependants
                pointeront ensuite vers la nouvelle annee active.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Lancement
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Le lancement d'une nouvelle annee peut reprendre les periodes de l'annee source
                pour accelerer la mise en service.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.05fr_1.45fr]">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <FiCheckCircle />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Cloture de l'annee active
                  </h3>
                  <p className="text-sm text-slate-500">
                    Termine proprement l'annee en cours avant de basculer sur la suivante.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Annee actuellement active
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {activeYear?.nom ?? "Aucune annee active"}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Debut: {formatDate(activeYear?.date_debut)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Fin: {formatDate(activeYear?.date_fin)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseActiveYear}
                disabled={!activeYear || isClosingYear}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiCheckCircle />
                {isClosingYear ? "Cloture..." : "Cloturer l'annee active"}
              </button>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                  <FiPlayCircle />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Lancer une nouvelle annee scolaire
                  </h3>
                  <p className="text-sm text-slate-500">
                    Cree la nouvelle annee et ferme l'ancienne si besoin, avec reprise optionnelle des periodes.
                  </p>
                </div>
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleLaunchNewYear}>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Nom</span>
                    <input
                      value={newYearForm.nom}
                      onChange={(event) =>
                        setNewYearForm((current) => ({
                          ...current,
                          nom: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                      placeholder="2027-2028"
                      required
                    />
                  </label>

                  <DateField
                    control={control}
                    name="date_debut"
                    label="Date de debut"
                    required
                  />

                  <DateField
                    control={control}
                    name="date_fin"
                    label="Date de fin"
                    required
                  />
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Annee source pour la reprise
                  </span>
                  <select
                    value={newYearForm.source_annee_id}
                    onChange={(event) =>
                      setNewYearForm((current) => ({
                        ...current,
                        source_annee_id: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    disabled={annees.length === 0}
                  >
                    <option value="">Aucune reprise</option>
                    {annees.map((annee) => (
                      <option key={annee.id} value={annee.id}>
                        {annee.nom}
                        {annee.est_active ? " (active)" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={newYearForm.copy_periodes}
                      onChange={(event) =>
                        setNewYearForm((current) => ({
                          ...current,
                          copy_periodes: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Reprendre les periodes
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        Recopie les periodes de l'annee source en conservant leur position relative.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={newYearForm.close_current_year}
                      onChange={(event) =>
                        setNewYearForm((current) => ({
                          ...current,
                          close_current_year: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Cloturer l'annee actuelle
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        Ferme l'annee active avant d'activer la nouvelle.
                      </span>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isStartingYear}
                  className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiCopy />
                  {isStartingYear ? "Lancement..." : "Lancer la nouvelle annee"}
                </button>
              </form>
            </article>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Apercu des annees scolaires</h3>
              <p className="text-sm text-slate-500">
                Les premieres annees disponibles pour l'etablissement actif.
              </p>
            </div>

            {previewAnnees.length > 0 ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {previewAnnees.map((annee) => (
                  <article
                    key={annee.id}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-base font-semibold text-slate-900">{annee.nom}</h4>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          annee.est_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {annee.est_active ? "Active" : "Archivee"}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p>Debut: {formatDate(annee.date_debut)}</p>
                      <p>Fin: {formatDate(annee.date_fin)}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucune annee scolaire n'est encore enregistree pour cet etablissement.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default AnneeScolaireOverview;
