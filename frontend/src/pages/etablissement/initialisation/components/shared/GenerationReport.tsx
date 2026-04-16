import type { InitialisationCommitResult } from "../../types";

type Props = {
  report: InitialisationCommitResult;
};

export default function GenerationReport({ report }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-5">
        <p className="text-sm font-semibold text-emerald-900">
          Generation terminee pour {report.type}.
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Les blocs deja supportes ont ete executes. Les autres restent clairement listes
          pour la prochaine passe.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(report.created).map(([key, value]) => (
          <div
            key={key}
            className="rounded-[22px] border border-slate-200 bg-white px-4 py-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {key}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {report.skipped.length > 0 ? (
        <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Elements ignores</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {report.skipped.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.deferred_blocks.length > 0 ? (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="text-sm font-semibold text-amber-900">Blocs reportes</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {report.deferred_blocks.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.warnings.length > 0 ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4">
          <p className="text-sm font-semibold text-rose-900">Avertissements</p>
          <ul className="mt-2 space-y-1 text-sm text-rose-800">
            {report.warnings.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
