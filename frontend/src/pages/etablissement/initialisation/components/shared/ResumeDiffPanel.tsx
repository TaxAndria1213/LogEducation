import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiLayers,
} from "react-icons/fi";
import type { InitialisationPreview } from "../../types";

type Props = {
  preview: InitialisationPreview | null;
};

export default function ResumeDiffPanel({ preview }: Props) {
  if (!preview) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef6ff_100%)] px-5 py-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
            <FiLayers />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">
              La previsualisation arrive ici
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Lance la previsualisation pour voir les blocs qui seront crees,
              reportes ou simplement prepares pour la suite.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Creation estimee
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
              <FiLayers />
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {preview.estimated_creates}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Blocs prets
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <FiCheckCircle />
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {preview.ready_blocks}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Blocs differes
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <FiClock />
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {preview.deferred_blocks}
          </p>
        </div>
      </div>

      {preview.warnings.length > 0 ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-amber-700">
              <FiAlertCircle />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Points d'attention</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {preview.blocks.map((block) => (
          <article
            key={block.code}
            className={`rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm ${
              block.statut === "PRET"
                ? "border-l-4 border-l-emerald-400"
                : block.statut === "IGNORE"
                  ? "border-l-4 border-l-slate-300"
                  : "border-l-4 border-l-amber-400"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {block.code}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      block.statut === "PRET"
                        ? "bg-emerald-100 text-emerald-700"
                        : block.statut === "IGNORE"
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {block.statut}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{block.libelle}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{block.description}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                  {block.mode}
                </span>
                <span className="text-xs text-slate-500">
                  {block.execution_disponible
                    ? `${block.estimation_creation} creation(s) immediates`
                    : "Bloc de cadrage uniquement"}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
