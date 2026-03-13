import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

/**
 * Stocke un objet JSON (ou undefined) via un textarea.
 * Saisie = string ; on parse en objet.
 */
export function JsonField<TFieldValues extends FieldValues>(props: BaseFieldProps<TFieldValues>) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field, fieldState }) => {
        const valueText =
          field.value == null
            ? ""
            : typeof field.value === "string"
              ? field.value
              : JSON.stringify(field.value, null, 2);

        return (
          <FieldWrapper
            id={id}
            label={props.label}
            description={props.description ?? "JSON"}
            required={props.required}
            error={fieldState.error?.message}
            className={props.className}
          >
            <textarea
              id={id}
              value={valueText}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw.trim() === "") return field.onChange(undefined);
                try {
                  field.onChange(JSON.parse(raw));
                } catch {
                  // garde le texte pour permettre la correction
                  field.onChange(raw);
                }
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              placeholder={props.placeholder ?? '{ "key": "value" }'}
              disabled={props.disabled}
              rows={8}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8, fontFamily: "monospace" }}
            />
          </FieldWrapper>
        );
      }}
    />
  );
}
