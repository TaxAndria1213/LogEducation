import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import { getMultiSelectClassName } from "./inputStyles";
import type { BaseFieldProps, Option } from "./types";

type Props<TFieldValues extends FieldValues> = BaseFieldProps<TFieldValues> & {
  options: Option<string>[];
};

/**
 * Pour relation many-to-many : tableau d'ids (string[])
 */
export function RelationMultiSelectField<TFieldValues extends FieldValues>({
  options,
  ...props
}: Props<TFieldValues>) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field, fieldState }) => {
        const value: string[] = Array.isArray(field.value) ? field.value : [];
        return (
          <FieldWrapper
            id={id}
            label={props.label}
            description={props.description}
            required={props.required}
            error={fieldState.error?.message}
            className={props.className}
          >
            <select
              id={id}
              multiple
              value={value}
              onChange={(e) => {
                const ids = Array.from(e.target.selectedOptions).map(
                  (o) => o.value,
                );
                field.onChange(ids.length ? ids : undefined);
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              disabled={props.disabled}
              className={getMultiSelectClassName(Boolean(fieldState.error))}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </select>
          </FieldWrapper>
        );
      }}
    />
  );
}
