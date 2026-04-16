import type { ReactNode } from "react";

type Tone = "slate" | "cyan" | "emerald" | "amber" | "rose";

const toneClasses: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  cyan: "bg-cyan-100 text-cyan-700 ring-cyan-200",
  emerald: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-100 text-amber-700 ring-amber-200",
  rose: "bg-rose-100 text-rose-700 ring-rose-200",
};

const progressClasses: Record<Tone, string> = {
  slate: "bg-slate-700",
  cyan: "bg-cyan-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

type Props = {
  title: string;
  value: string | number;
  hint: string;
  icon?: ReactNode;
  tone?: Tone;
  progress?: number;
};

export default function InitialisationStatusCard({
  title,
  value,
  hint,
  icon,
  tone = "slate",
  progress,
}: Props) {
  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        {icon ? (
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${toneClasses[tone]}`}
          >
            {icon}
          </div>
        ) : null}
      </div>

      {typeof progress === "number" ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${progressClasses[tone]}`}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
  );
}
