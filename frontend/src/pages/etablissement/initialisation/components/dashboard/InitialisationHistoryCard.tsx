import type { InitialisationSession } from "../../types";

type Props = {
  sessions: InitialisationSession[];
};

function formatDate(value?: Date | string) {
  if (!value) return "Date indisponible";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
    .join(" ");
}

export default function InitialisationHistoryCard({ sessions }: Props) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Historique recent</h3>
        <p className="text-sm text-slate-500">
          Les derniers jalons visibles du parcours d'amorcage et des annees scolaires.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Aucune trace d'initialisation n'est encore visible pour cet etablissement.
        </div>
      ) : (
        <div className="mt-5 space-y-0">
          {sessions.slice(0, 5).map((session, index, list) => (
            <div key={session.id} className="relative pl-8">
              {index < list.length - 1 ? (
                <span className="absolute left-[11px] top-8 h-[calc(100%-1.25rem)] w-px bg-slate-200" />
              ) : null}
              <span className="absolute left-0 top-5 h-6 w-6 rounded-full border border-slate-200 bg-white shadow-sm" />
              <article className="mb-4 rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {formatType(session.type)}
                      </span>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                        {session.statut}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{session.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{session.summary}</p>
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {formatDate(session.created_at)}
                  </p>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
