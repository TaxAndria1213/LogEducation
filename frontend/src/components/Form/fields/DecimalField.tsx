import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import { getInputClassName } from "./inputStyles";
import type { BaseFieldProps } from "./types";

/**
 * Prisma.Decimal est souvent sérialisé en string (API/JSON).
 * Ce champ garde une string pour éviter les erreurs de précision.
 */
export function DecimalField<TFieldValues extends FieldValues>(
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
            inputMode="decimal"
            value={field.value ?? ""}
            onChange={(e) =>
              field.onChange(e.target.value === "" ? undefined : e.target.value)
            }
            onBlur={field.onBlur}
            onWheel={(e) => e.currentTarget.blur()}
            ref={field.ref}
            placeholder={props.placeholder ?? "0.00"}
            disabled={props.disabled}
            className={getInputClassName(Boolean(fieldState.error))}
          />
        </FieldWrapper>
      )}
    />
  );
}
