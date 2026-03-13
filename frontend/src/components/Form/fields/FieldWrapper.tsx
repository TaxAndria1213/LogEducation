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
    <div className={className} style={{ display: "grid", gap: 6 }}>
      {label ? (
        <label htmlFor={id} style={{ fontWeight: 600, fontSize: 14 }}>
          {label} {required ? <span aria-hidden="true" style={{ color: "crimson" }}>*</span> : null}
        </label>
      ) : null}

      {children}

      {description ? (
        <div style={{ fontSize: 12, opacity: 0.8 }}>{description}</div>
      ) : null}

      {error ? (
        <div role="alert" style={{ fontSize: 12, color: "crimson" }}>
          {friendlyErrorMessage(error)}
        </div>
      ) : null}
    </div>
  );
}
