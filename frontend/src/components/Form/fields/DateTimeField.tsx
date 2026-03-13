import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

function toDateTimeLocalValue(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function DateTimeField<TFieldValues extends FieldValues>(props: BaseFieldProps<TFieldValues>) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
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
            type="datetime-local"
            value={toDateTimeLocalValue(field.value)}
            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
            onBlur={field.onBlur}
            ref={field.ref}
            disabled={props.disabled}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </FieldWrapper>
      )}
    />
  );
}
