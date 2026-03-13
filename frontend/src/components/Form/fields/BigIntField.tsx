import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

/**
 * BigInt ne passe pas bien en JSON → souvent string en DTO.
 * Ici on stocke une string pour être sûr.
 */
export function BigIntField<TFieldValues extends FieldValues>(props: BaseFieldProps<TFieldValues>) {
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
            inputMode="numeric"
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
            onBlur={field.onBlur}
            onWheel={(e) => e.currentTarget.blur()}
            ref={field.ref}
            placeholder={props.placeholder}
            disabled={props.disabled}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </FieldWrapper>
      )}
    />
  );
}
