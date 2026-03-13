import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function StringArrayField<TFieldValues extends FieldValues>(props: BaseFieldProps<TFieldValues>) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field, fieldState }) => {
        const arr: string[] = Array.isArray(field.value) ? field.value : [];
        return (
          <FieldWrapper
            id={id}
            label={props.label}
            description={props.description ?? "Sépare par virgules"}
            required={props.required}
            error={fieldState.error?.message}
            className={props.className}
          >
            <input
              id={id}
              type="text"
              value={arr.join(", ")}
              onChange={(e) => {
                const v = e.target.value;
                const next = v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                field.onChange(next.length ? next : undefined);
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              placeholder={props.placeholder ?? "a, b, c"}
              disabled={props.disabled}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </FieldWrapper>
        );
      }}
    />
  );
}
