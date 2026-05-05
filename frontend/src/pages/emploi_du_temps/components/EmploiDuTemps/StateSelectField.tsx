import { EditableSelect } from "../../../../components/Form/fields/EditableSelect";
import type { Option } from "../../../../components/Form/fields/types";

type StateSelectFieldProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option<string>[];
  label?: string;
  description?: string;
  disabled?: boolean;
  required?: boolean;
  emptyLabel?: string;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  className?: string;
};

export default function StateSelectField({
  value,
  onChange,
  options,
  label,
  description,
  disabled,
  required,
  emptyLabel,
  searchPlaceholder,
  noResultsLabel,
  className,
}: StateSelectFieldProps) {
  return (
    <EditableSelect
      value={value}
      onChange={onChange}
      options={options}
      label={label}
      description={description}
      disabled={disabled}
      required={required}
      emptyLabel={emptyLabel}
      searchPlaceholder={searchPlaceholder}
      noResultsLabel={noResultsLabel}
      className={className}
    />
  );
}
