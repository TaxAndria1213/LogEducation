import type { Control, FieldValues, Path } from "react-hook-form";

export type BaseFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export type Option<T extends string | number = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};
