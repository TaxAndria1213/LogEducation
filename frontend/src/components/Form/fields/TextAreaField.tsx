import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";
import { getInputClassName } from "./inputStyles";

export function TextAreaField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  required,
  className,
}: BaseFieldProps<TFieldValues>) {
  const id = String(name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          id={id}
          label={label}
          description={description}
          required={required}
          error={fieldState.error?.message}
          className={className}
        >
          <textarea
            id={id}
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            ref={field.ref}
            placeholder={placeholder}
            disabled={disabled}
            rows={4}
            className={`${getInputClassName(Boolean(fieldState.error))} min-h-28 resize-y`}
          />
        </FieldWrapper>
      )}
    />
  );
}
