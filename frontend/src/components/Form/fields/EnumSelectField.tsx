import type { FieldValues } from "react-hook-form";
import type { BaseFieldProps, Option } from "./types";
import { SelectField } from "./SelectField";

type Props<TFieldValues extends FieldValues> = BaseFieldProps<TFieldValues> & {
  values: readonly string[]; // ex: Object.values(MyEnum)
  labels?: Partial<Record<string, string>>;
  emptyLabel?: string;
};

export function EnumSelectField<TFieldValues extends FieldValues>({
  values,
  labels,
  emptyLabel,
  ...base
}: Props<TFieldValues>) {
  const options: Option<string>[] = values.map((v) => ({
    value: v,
    label: labels?.[v] ?? v,
  }));

  return <SelectField {...base} options={options} emptyLabel={emptyLabel} />;
}
