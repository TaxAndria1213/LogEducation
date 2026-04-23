import type { FieldValues } from "react-hook-form";
import { SelectField, type SelectFieldProps } from "./SelectField";

type Props<
  TFieldValues extends FieldValues,
  TValue extends string | number = string,
> = SelectFieldProps<TFieldValues, TValue>;

/**
 * Pour une relation 1-n / n-1 : on stocke l'id (string).
 */
export function RelationSelectField<
  TFieldValues extends FieldValues,
  TValue extends string | number = string,
>(props: Props<TFieldValues, TValue>) {
  return <SelectField {...props} emptyLabel={props.emptyLabel ?? "Aucun"} />;
}
