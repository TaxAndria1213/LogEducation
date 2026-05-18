import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCircleCheck,
  faCircleXmark,
  faDownload,
  faEye,
  faFileLines,
  faPen,
  faPrint,
  faToggleOff,
  faToggleOn,
  faTrash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition, IconProp } from "@fortawesome/fontawesome-svg-core";
import type { RowAction } from "./types";

type DataTableActionButtonProps<T> = {
  action: RowAction<T>;
  row: T;
  onExecute?: (action: RowAction<T>, row: T) => boolean | void | Promise<boolean | void>;
};

function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

function getActionIcon<T>(action: RowAction<T>): IconDefinition | null {
  const label = normalizeLabel(action.label);

  if (action.kind === "view" || label.includes("voir")) return faEye;
  if (action.kind === "edit" || label.includes("modifier")) return faPen;
  if (action.kind === "delete" || label.includes("supprimer")) return faTrash;
  if (label.includes("détail") || label.includes("detail")) return faFileLines;
  if (label.includes("imprimer")) return faPrint;
  if (label.includes("télécharger") || label.includes("telecharger")) return faDownload;
  if (label.includes("valider")) return faCheck;
  if (label.includes("annuler")) return faXmark;
  if (label.includes("activer")) return faToggleOn;
  if (label.includes("désactiver") || label.includes("desactiver")) return faToggleOff;
  if (label.includes("approuver")) return faCircleCheck;
  if (label.includes("rejeter") || label.includes("refuser")) return faCircleXmark;
  return null;
}

function getVariantClassName<T>(action: RowAction<T>) {
  if (action.variant === "danger" || action.kind === "delete") {
    return "border-rose-200 bg-white text-rose-600 hover:border-rose-300 hover:bg-rose-50";
  }

  if (action.variant === "primary") {
    return "border-slate-900 bg-slate-900 text-white hover:bg-slate-800";
  }

  return "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700";
}

function shouldUseCustomRender<T>(action: RowAction<T>) {
  if (!action.render) return false;
  return action.kind === "custom";
}

export function DataTableActionButton<T>({
  action,
  row,
  onExecute,
}: DataTableActionButtonProps<T>) {
  const actionIcon = getActionIcon(action);
  const useLabel = !shouldUseCustomRender(action) && !actionIcon;

  const onClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (action.confirm) {
      const ok = window.confirm(
        `${action.confirm.title ? `${action.confirm.title}\n\n` : ""}${action.confirm.message ?? "Confirmer ?"}`,
      );
      if (!ok) return;
    }
    if (onExecute) {
      const handled = await onExecute(action, row);
      if (handled) {
        return;
      }
    }

    await action.onClick(row);
  };

  return (
    <button
      type="button"
      title={action.label}
      aria-label={action.label}
      onClick={onClick}
      className={[
        "inline-flex h-9 items-center justify-center rounded-2xl border text-sm shadow-sm transition",
        useLabel ? "w-auto px-3 text-xs font-bold" : "w-9",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        getVariantClassName(action),
      ].join(" ")}
    >
      {shouldUseCustomRender(action) ? (
        action.render?.(row)
      ) : useLabel ? (
        <span className="max-w-32 truncate">{action.label}</span>
      ) : (
        <FontAwesomeIcon icon={actionIcon as IconProp} />
      )}
    </button>
  );
}

type DataTableActionsProps<T> = {
  actions: RowAction<T>[];
  row: T;
  onExecute?: (action: RowAction<T>, row: T) => boolean | void | Promise<boolean | void>;
};

export default function DataTableActions<T>({
  actions,
  row,
  onExecute,
}: DataTableActionsProps<T>) {
  return (
    <div className="flex flex-col items-center justify-end gap-1.5">
      {actions.map((action, index) => (
        <DataTableActionButton
          key={`${action.label}-${index}`}
          action={action}
          row={row}
          onExecute={onExecute}
        />
      ))}
    </div>
  );
}
