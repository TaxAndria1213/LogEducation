import React from "react";

function friendlyErrorMessage(msg?: string) {
  if (!msg) return undefined;

  // Zod (souvent)
  if (msg.includes("expected string") && msg.includes("received undefined")) {
    return "Ce champ est requis.";
  }
  if (msg.includes("expected number") && msg.includes("received undefined")) {
    return "Ce champ est requis.";
  }
  if (msg.includes("Invalid input")) {
    return "Valeur invalide.";
  }

  return msg; // fallback
}

type Props = {
  id: string;
  label?: string;
  description?: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

export function FieldWrapper({
  id,
  label,
  description,
  required,
  error,
  className,
  children,
}: Props) {
  return (
    <div className={className ?? "space-y-2"}>
      {label ? (
        <label
          htmlFor={id}
          className="flex items-center gap-1 text-sm font-semibold text-slate-800"
        >
          <span>{label}</span>
          {required ? (
            <span aria-hidden="true" className="text-rose-500">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {children}

      {description ? (
        <div className="text-xs leading-5 text-slate-500">{description}</div>
      ) : null}

      {error ? (
        <div role="alert" className="text-xs font-medium text-rose-600">
          {friendlyErrorMessage(error)}
        </div>
      ) : null}
    </div>
  );
}
