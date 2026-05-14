import { Controller, type FieldValues } from "react-hook-form";
import React from "react";
import Service from "../../../app/api/Service";
import { tableQueryToParams } from "../../../shared/table/query";
import type { TableQuery } from "../../../shared/table/types";
import { FieldWrapper } from "./FieldWrapper";
import { getMultiSelectClassName } from "./inputStyles";
import type { BaseFieldProps, Option } from "./types";

type Props<TFieldValues extends FieldValues> = BaseFieldProps<TFieldValues> & {
  options?: Array<Option<string | number>>;
  service?: Service;
  initialQuery?: TableQuery;
  mapOption?: (row: Record<string, unknown>) => Option<string | number>;
  getOptionLabel?: (row: Record<string, unknown>) => string;
  getOptionValue?: (row: Record<string, unknown>) => string | number;
};

/**
 * Pour relation many-to-many : tableau d'ids (string[])
 */
export function RelationMultiSelectField<TFieldValues extends FieldValues>({
  options,
  service,
  initialQuery,
  mapOption,
  getOptionLabel,
  getOptionValue,
  ...props
}: Props<TFieldValues>) {
  const id = String(props.name);
  const [remoteOptions, setRemoteOptions] = React.useState<
    Array<Option<string | number>>
  >(options ?? []);

  React.useEffect(() => {
    setRemoteOptions(options ?? []);
  }, [options]);

  React.useEffect(() => {
    if (!service) return;

    let cancelled = false;

    const loadOptions = async () => {
      try {
        const response = await service.getAll(
          tableQueryToParams({
            page: 1,
            take: 500,
            ...(initialQuery ?? {}),
          }),
        );

        const rows = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : [];

        const nextOptions = rows
          .flatMap((row: unknown) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
              return [];
            }

            const record = row as Record<string, unknown>;
            if (mapOption) {
              return [mapOption(record)];
            }

            const value =
              getOptionValue?.(record) ??
              (typeof record.id === "string" || typeof record.id === "number"
                ? record.id
                : null);
            if (value == null) {
              return [];
            }

            const label =
              getOptionLabel?.(record) ??
              (typeof record.nom === "string" && record.nom.trim()
                ? record.nom.trim()
                : typeof record.libelle === "string" && record.libelle.trim()
                  ? record.libelle.trim()
                  : typeof record.label === "string" && record.label.trim()
                    ? record.label.trim()
                    : typeof record.name === "string" && record.name.trim()
                      ? record.name.trim()
                      : typeof record.code === "string" && record.code.trim()
                        ? record.code.trim()
                        : String(value));

            return [
              {
                value,
                label,
              },
            ];
          })
          .filter(
            (option: { value: string | number }, index: number, allOptions: { value: string | number }[]) =>
              allOptions.findIndex(
                (candidate) => String(candidate.value) === String(option.value),
              ) === index,
          );

        if (!cancelled) {
          setRemoteOptions(nextOptions);
        }
      } catch {
        if (!cancelled) {
          setRemoteOptions(options ?? []);
        }
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [
    getOptionLabel,
    getOptionValue,
    initialQuery,
    mapOption,
    options,
    service,
  ]);

  const resolvedOptions = remoteOptions;

  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field, fieldState }) => {
        const value: string[] = Array.isArray(field.value)
          ? field.value.map((entry: unknown) => String(entry))
          : [];
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
                const ids = Array.from(e.target.selectedOptions).map((option: { value: string | number }) => {
                  const matchedOption = resolvedOptions.find(
                    (candidate) => String(candidate.value) === option.value,
                  );
                  return matchedOption?.value ?? option.value;
                });
                field.onChange(ids.length ? ids : undefined);
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              disabled={props.disabled}
              className={getMultiSelectClassName(Boolean(fieldState.error))}
            >
              {resolvedOptions.map((o) => (
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
