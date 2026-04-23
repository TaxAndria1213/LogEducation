import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import { getInputClassName } from "./inputStyles";
import type { BaseFieldProps } from "./types";

export function NumberArrayField<TFieldValues extends FieldValues>(
  props: BaseFieldProps<TFieldValues>,
) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field, fieldState }) => {
        const arr: number[] = Array.isArray(field.value) ? field.value : [];
        return (
          <FieldWrapper
            id={id}
            label={props.label}
            description={props.description ?? "Nombres séparés par virgules"}
            required={props.required}
            error={fieldState.error?.message}
            className={props.className}
          >
            <input
              id={id}
              type="text"
              value={arr.join(", ")}
              onChange={(e) => {
                const raw = e.target.value;
                const parts = raw
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                const nums = parts
                  .map((p) => Number(p))
                  .filter((n) => Number.isFinite(n));
                field.onChange(nums.length ? nums : undefined);
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              placeholder={props.placeholder ?? "1, 2, 3"}
              disabled={props.disabled}
              className={getInputClassName(Boolean(fieldState.error))}
            />
          </FieldWrapper>
        );
      }}
    />
  );
}
