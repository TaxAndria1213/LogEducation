import type { FieldValues } from "react-hook-form";
import type { BaseFieldProps, Option } from "./types";
import { SelectField } from "./SelectField";

type Props<TFieldValues extends FieldValues> = BaseFieldProps<TFieldValues> & {
  options: Option<string>[];
  emptyLabel?: string;
};

/**
 * Pour une relation 1-n / n-1 : on stocke l'id (string).
 */
export function RelationSelectField<TFieldValues extends FieldValues>(props: Props<TFieldValues>) {
  return <SelectField {...props} options={props.options} emptyLabel={props.emptyLabel ?? "Aucun"} />;
}
