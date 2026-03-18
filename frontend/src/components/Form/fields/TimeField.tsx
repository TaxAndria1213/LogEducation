import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

type TimeFieldProps<TFieldValues extends FieldValues> =
  BaseFieldProps<TFieldValues> & {
    defaultValue?: string;
    min?: string;
    max?: string;
    step?: number;
  };

function normalizeTime(value: unknown): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (!match) return trimmed;

  return `${match[1]}:${match[2]}`;
}

export function TimeField<TFieldValues extends FieldValues>(
  props: TimeFieldProps<TFieldValues>,
) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
      defaultValue={props.defaultValue as never}
      render={({ field, fieldState }) => (
        <FieldWrapper
          id={id}
          label={props.label}
          description={props.description}
          required={props.required}
          error={fieldState.error?.message}
          className={props.className}
        >
          <input
            id={id}
            type="time"
            value={normalizeTime(field.value ?? props.defaultValue)}
            onChange={(e) => field.onChange(e.target.value || undefined)}
            onBlur={field.onBlur}
            ref={field.ref}
            min={props.min}
            max={props.max}
            step={props.step}
            disabled={props.disabled}
            style={{
              width: "100%",
              minHeight: 44,
              padding: "10px 12px",
              borderRadius: 8,
              border: fieldState.error ? "1px solid #d32f2f" : "1px solid #ccc",
              background: props.disabled ? "#f5f5f5" : "#fff",
            }}
          />
        </FieldWrapper>
      )}
    />
  );
}
