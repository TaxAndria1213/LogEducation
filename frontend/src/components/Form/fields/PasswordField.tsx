import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import { getInputClassName } from "./inputStyles";
import type { BaseFieldProps } from "./types";

export function PasswordField<TFieldValues extends FieldValues>(
  props: BaseFieldProps<TFieldValues>,
) {
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
            type="password"
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            ref={field.ref}
            placeholder={props.placeholder}
            disabled={props.disabled}
            className={getInputClassName(Boolean(fieldState.error))}
          />
        </FieldWrapper>
      )}
    />
  );
}
