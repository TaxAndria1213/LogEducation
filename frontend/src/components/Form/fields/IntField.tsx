import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";
import { getInputClassName } from "./inputStyles";

export function IntField<TFieldValues extends FieldValues>(props: BaseFieldProps<TFieldValues>) {
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
            type="number"
            step={1}
            value={field.value ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              field.onChange(v === "" ? undefined : Number.parseInt(v, 10));
            }}
            onBlur={field.onBlur}
            onWheel={(e) => e.currentTarget.blur()}
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
