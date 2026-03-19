import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiCalendar, FiClock, FiMapPin, FiTrendingUp } from "react-icons/fi";
import { useAuth } from "../../../../auth/AuthContext";
import Spin from "../../../../components/anim/Spin";
import EvenementCalendrierService from "../../../../services/evenementCalendrier.service";
import { formatDateWithLocalTimezone } from "../../../../app/utils/functions";
import {
  getEventDurationLabel,
  getEventStatus,
  getEventTypeLabel,
  isEventOnSameDay,
  type EventRow,
} from "../../types";
import { useEvenementStore } from "../../store/EvenementIndexStore";
import { useEvenementCreateStore } from "../../store/EvenementCreateStore";

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function EventDashboard() {
  const { etablissement_id } = useAuth();
  const eventService = useMemo(() => new EvenementCalendrierService(), []);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const setRenderedComponent = useEvenementStore((state) => state.setRenderedComponent);
  const resetEditor = useEvenementCreateStore((state) => state.resetEditor);

  useEffect(() => {
    const run = async () => {
      if (!etablissement_id) {
        setEvents([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await eventService.getAll({
          take: 5000,
          where: JSON.stringify({ etablissement_id }),
          includeSpec: JSON.stringify({ site: true }),
          orderBy: JSON.stringify([{ debut: "asc" }]),
        });

        setEvents(
          result?.status.success ? (result.data.data as EventRow[]) : [],
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [etablissement_id, eventService]);

  const { todayCount, upcomingCount, activeCount, thisMonthCount, nextEvents, byType } =
    useMemo(() => {
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();

      const next = events
        .filter((event) => new Date(event.fin) >= now)
        .slice(0, 6);

      const typeMap = new Map<string, number>();
      for (const event of events) {
        const type = getEventTypeLabel(event.type);
        typeMap.set(type, (typeMap.get(type) ?? 0) + 1);
      }

      return {
        todayCount: events.filter((event) => isEventOnSameDay(event, now)).length,
        upcomingCount: events.filter((event) => new Date(event.debut) > now).length,
        activeCount: events.filter((event) => {
          const start = new Date(event.debut);
          const end = new Date(event.fin);
          return start <= now && end >= now;
        }).length,
        thisMonthCount: events.filter((event) => {
          const start = new Date(event.debut);
          return start.getMonth() === month && start.getFullYear() === year;
        }).length,
        nextEvents: next,
        byType: [...typeMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
      };
    }, [events]);

  if (loading) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <Spin label="Chargement du tableau de bord des evenements..." showLabel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(135deg,_#ffffff_0%,_#eff6ff_45%,_#f8fafc_100%)] px-6 py-6 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-sky-700">
              Calendrier des evenements
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Pilote les temps forts de l'etablissement dans une vue claire
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Suis les rendez-vous du jour, les examens, les reunions et les
              activites a venir. Tu peux revenir rapidement sur la liste ou
              preparer un nouvel evenement depuis ce tableau de bord.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                resetEditor(etablissement_id);
                setRenderedComponent("add");
              }}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Nouvel evenement
            </button>
            <button
              type="button"
              onClick={() => setRenderedComponent("list")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Ouvrir la liste
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FiCalendar />}
          label="Evenements aujourd'hui"
          value={todayCount}
          hint="Toutes categories confondues pour la journee."
        />
        <StatCard
          icon={<FiClock />}
          label="En cours"
          value={activeCount}
          hint="Evenements actuellement actifs."
        />
        <StatCard
          icon={<FiTrendingUp />}
          label="A venir"
          value={upcomingCount}
          hint="Evenements qui commencent apres maintenant."
        />
        <StatCard
          icon={<FiMapPin />}
          label="Ce mois-ci"
          value={thisMonthCount}
          hint="Charge globale du calendrier sur le mois courant."
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Prochains evenements
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Les prochains rendez-vous planifies dans le calendrier.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {nextEvents.length > 0 ? (
              nextEvents.map((event) => {
                const status = getEventStatus(event);
                const start = formatDateWithLocalTimezone(event.debut.toString());
                const end = formatDateWithLocalTimezone(event.fin.toString());

                return (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => setRenderedComponent("list")}
                    className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {event.titre}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {getEventTypeLabel(event.type)}
                          {event.site?.nom ? ` - ${event.site.nom}` : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${status.tone}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{start.dateHeure}</span>
                      <span>Fin: {end.dateHeure}</span>
                      <span>Duree: {getEventDurationLabel(event)}</span>
                    </div>

                    {event.description ? (
                      <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                        {event.description}
                      </p>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Aucun evenement n'est encore planifie pour la suite.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
            <h3 className="text-lg font-semibold text-slate-900">
              Repartition par type
            </h3>
            <div className="mt-4 grid gap-3">
              {byType.length > 0 ? (
                byType.map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {type}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Aucune categorie n'est encore alimentee.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
            <h3 className="text-lg font-semibold text-slate-900">
              Bonnes pratiques
            </h3>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                Renseigne le site pour faciliter la lecture et anticiper les
                conflits de lieu.
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                Garde un titre court et explicite pour qu'il reste lisible dans
                les vues agenda et les listes.
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                Controle les plages horaires avant publication pour eviter les
                superpositions sur un meme site.
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
