import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps, Option } from "./types";

type Props<TFieldValues extends FieldValues, TValue extends string | number> =
  BaseFieldProps<TFieldValues> & {
    options: Option<TValue>[];
    emptyLabel?: string;
  };

export function SelectField<TFieldValues extends FieldValues, TValue extends string | number>({
  control,
  name,
  label,
  description,
  disabled,
  required,
  className,
  options,
  emptyLabel = "—",
}: Props<TFieldValues, TValue>) {
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
          <select
            id={id}
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
            onBlur={field.onBlur}
            ref={field.ref}
            disabled={disabled}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          >
            <option value="">{emptyLabel}</option>
            {options.map((o) => (
              <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldWrapper>
      )}
    />
  );
}
