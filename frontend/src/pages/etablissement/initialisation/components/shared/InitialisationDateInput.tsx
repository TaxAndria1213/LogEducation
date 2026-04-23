import { useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { DateField } from "../../../../../components/Form/fields/DateField";

type DateFormValues = Record<string, string | undefined>;

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
};

function toFieldName(id: string) {
  return `date_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

export default function InitialisationDateInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  disabled,
  className,
}: Props) {
  const fieldName = useMemo(() => toFieldName(id), [id]);
  const onChangeRef = useRef(onChange);
  const lastPropValueRef = useRef(value || "");
  const form = useForm<DateFormValues>({
    defaultValues: {
      [fieldName]: value || undefined,
    },
  });
  const currentValue = useWatch({
    control: form.control,
    name: fieldName,
  });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const normalizedValue = value || undefined;
    lastPropValueRef.current = value || "";
    if (form.getValues(fieldName) !== normalizedValue) {
      form.setValue(fieldName, normalizedValue, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [fieldName, form, value]);

  useEffect(() => {
    const normalizedCurrentValue = currentValue ?? "";
    const normalizedFormValue = form.getValues(fieldName) ?? "";

    if (normalizedFormValue !== normalizedCurrentValue) {
      return;
    }

    if (normalizedCurrentValue !== lastPropValueRef.current) {
      lastPropValueRef.current = normalizedCurrentValue;
      onChangeRef.current(normalizedCurrentValue);
    }
  }, [currentValue, fieldName, form]);

  return (
    <DateField<DateFormValues>
      control={form.control}
      name={fieldName}
      label={label}
      min={min}
      max={max}
      disabled={disabled}
      className={className}
    />
  );
}
