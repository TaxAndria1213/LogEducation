import { Controller, type FieldValues } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";
import { getInputClassName } from "./inputStyles";

export function FloatField<TFieldValues extends FieldValues>(
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
          <NumericFormat
            id={id}
            value={field.value ?? ""}
            thousandSeparator=" "
            decimalSeparator=","
            allowNegative
            decimalScale={20}
            fixedDecimalScale={false}
            placeholder={props.placeholder}
            disabled={props.disabled}
            getInputRef={field.ref}
            onBlur={field.onBlur}
            onWheel={(e) => e.currentTarget.blur()}
            onValueChange={(values) => {
              field.onChange(values.floatValue ?? undefined);
            }}
            className={getInputClassName(Boolean(fieldState.error))}
          />
        </FieldWrapper>
      )}
    />
  );
}
