import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export type FinanceHeroHighlight = {
  id: string;
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

export type FinanceHeroAction = {
  id: string;
  label: string;
  description?: string;
  onClick?: () => void;
  to?: string;
  tone?: "primary" | "secondary" | "ghost";
};

export type FinanceControlTone = "info" | "success" | "warning" | "danger";

const highlightToneClasses: Record<NonNullable<FinanceHeroHighlight["tone"]>, string> = {
  default: "border-white/65 bg-white/80 text-slate-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-rose-200 bg-rose-50 text-rose-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

const actionToneClasses: Record<NonNullable<FinanceHeroAction["tone"]>, string> = {
  primary: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
  secondary: "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
  ghost: "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200",
};

const controlToneClasses: Record<FinanceControlTone, string> = {
  info: "border-sky-200 bg-sky-50/80 text-sky-900",
  success: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
  warning: "border-amber-200 bg-amber-50/80 text-amber-900",
  danger: "border-rose-200 bg-rose-50/80 text-rose-900",
};

export function FinanceHeroSection({
  eyebrow,
  title,
  description,
  highlights = [],
  actions = [],
  aside,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  highlights?: FinanceHeroHighlight[];
  actions?: FinanceHeroAction[];
  aside?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="absolute inset-y-0 right-0 hidden w-72 bg-slate-100/80 lg:block" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl space-y-4">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-800">{eyebrow}</p>
          ) : null}
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </div>

          {actions.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {actions.map((action) => {
                const tone = action.tone ?? "secondary";
                const className = `rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${actionToneClasses[tone]}`;
                const content = (
                  <span className="flex flex-col gap-1">
                    <span>{action.label}</span>
                    {action.description ? <span className="text-xs font-normal opacity-80">{action.description}</span> : null}
                  </span>
                );

                if (action.to) {
                  return (
                    <NavLink key={action.id} to={action.to} className={className}>
                      {content}
                    </NavLink>
                  );
                }

                return (
                  <button key={action.id} type="button" onClick={action.onClick} className={className}>
                    {content}
                  </button>
                );
              })}
            </div>
          ) : null}

          {highlights.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {highlights.map((highlight) => {
                const tone = highlight.tone ?? "default";
                return (
                  <article
                    key={highlight.id}
                    className={`rounded-[24px] border px-4 py-4 shadow-sm backdrop-blur ${highlightToneClasses[tone]}`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">{highlight.label}</p>
                    <p className="mt-3 text-2xl font-semibold">{highlight.value}</p>
                    {highlight.helper ? <p className="mt-2 text-xs opacity-80">{highlight.helper}</p> : null}
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>

        {aside ? <div className="relative xl:w-[320px] xl:min-w-[320px]">{aside}</div> : null}
      </div>
    </section>
  );
}

export function FinanceMetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 text-slate-500">
        {icon ? <span className="text-base">{icon}</span> : null}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
    </article>
  );
}

export function FinanceControlBanner({
  label,
  title,
  description,
  tone = "info",
  action,
}: {
  label: string;
  title: string;
  description: string;
  tone?: FinanceControlTone;
  action?: ReactNode;
}) {
  return (
    <article className={`rounded-[24px] border px-4 py-4 shadow-sm ${controlToneClasses[tone]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">{label}</p>
          <h3 className="mt-2 text-base font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 opacity-85">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </article>
  );
}
