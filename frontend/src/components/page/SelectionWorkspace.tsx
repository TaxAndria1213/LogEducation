import type { ReactNode } from "react";

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type SelectionWorkspaceHeaderCardProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  actionsClassName?: string;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
};

export function SelectionWorkspaceHeaderCard({
  title,
  description,
  actions,
  actionsClassName,
  children,
  className,
  headerClassName,
}: SelectionWorkspaceHeaderCardProps) {
  return (
    <section
      className={joinClasses(
        "rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div
        className={joinClasses(
          "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between",
          headerClassName,
        )}
      >
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {description ? (
            <div className="mt-1 text-sm leading-6 text-slate-600">
              {description}
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className={joinClasses("shrink-0", actionsClassName)}>{actions}</div>
        ) : null}
      </div>

      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

type SelectionWorkspacePanelProps = {
  title: string;
  description?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  footerTitle: ReactNode;
  footerDescription?: ReactNode;
  footerAction: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  toolbarClassName?: string;
  footerClassName?: string;
  maxBodyHeightClassName?: string;
};

export function SelectionWorkspacePanel({
  title,
  description,
  toolbar,
  children,
  footerTitle,
  footerDescription,
  footerAction,
  className,
  bodyClassName,
  headerClassName,
  toolbarClassName,
  footerClassName,
  maxBodyHeightClassName = "max-h-[58vh]",
}: SelectionWorkspacePanelProps) {
  return (
    <section
      className={joinClasses(
        "overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      <div
        className={joinClasses(
          "border-b border-slate-200 bg-slate-50/80 px-5 py-4",
          headerClassName,
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {description ? (
              <div className="text-sm leading-6 text-slate-600">{description}</div>
            ) : null}
          </div>

          {toolbar ? (
            <div className={joinClasses("shrink-0", toolbarClassName)}>{toolbar}</div>
          ) : null}
        </div>
      </div>

      <div
        className={joinClasses(
          maxBodyHeightClassName,
          "overflow-y-auto px-4 py-4",
          bodyClassName,
        )}
      >
        {children}
      </div>

      <div className="sticky bottom-4 z-10 px-4 pb-4">
        <div
          className={joinClasses(
            "flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/95 px-5 py-4 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between",
            footerClassName,
          )}
        >
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">{footerTitle}</div>
            {footerDescription ? (
              <div className="text-sm text-slate-600">{footerDescription}</div>
            ) : null}
          </div>

          {footerAction}
        </div>
      </div>
    </section>
  );
}
