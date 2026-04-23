import React from "react";
import {
  Controller,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldValues,
} from "react-hook-form";
import Service from "../../../app/api/Service";
import { tableQueryToParams } from "../../../shared/table/query";
import type { TableQuery } from "../../../shared/table/types";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps, Option } from "./types";
import { getInputClassName, getSurfaceClassName } from "./inputStyles";

type SelectRow = Record<string, unknown>;

export type SelectFieldProps<
  TFieldValues extends FieldValues,
  TValue extends string | number,
  TRow extends SelectRow = SelectRow,
> = BaseFieldProps<TFieldValues> & {
  options?: Option<TValue>[];
  emptyLabel?: string;
  service?: Service;
  initialQuery?: TableQuery;
  onSearchBuildWhere?: (text: string) => Record<string, unknown>;
  mapOption?: (row: TRow) => Option<TValue>;
  getOptionLabel?: (row: TRow) => string;
  getOptionValue?: (row: TRow) => TValue;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  loadingLabel?: string;
};

type SelectFieldControlProps<
  TFieldValues extends FieldValues,
  TValue extends string | number,
  TRow extends SelectRow = SelectRow,
> = Omit<SelectFieldProps<TFieldValues, TValue, TRow>, "control" | "name"> & {
  id: string;
  field: ControllerRenderProps<TFieldValues>;
  fieldState: ControllerFieldState;
};

function isRecord(value: unknown): value is SelectRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function areOptionValuesEqual(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
) {
  if (left == null || right == null) return false;
  return String(left) === String(right);
}

function uniqueOptions<TValue extends string | number>(
  options: Option<TValue>[],
) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = String(option.value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractRowsFromResponse(payload: unknown): SelectRow[] {
  const data = isRecord(payload) && "data" in payload ? payload.data : payload;

  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  if (isRecord(data) && Array.isArray(data.data)) {
    return data.data.filter(isRecord);
  }

  return [];
}

function inferOptionValue<TValue extends string | number>(
  row: SelectRow,
): TValue | null {
  const rawValue = row.id ?? row.value ?? row.code;
  if (typeof rawValue === "string" || typeof rawValue === "number") {
    return rawValue as TValue;
  }
  return null;
}

function inferOptionLabel(row: SelectRow) {
  const directKeys = [
    "label",
    "nom",
    "libelle",
    "title",
    "name",
    "code",
    "email",
  ];
  for (const key of directKeys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const prenom = typeof row.prenom === "string" ? row.prenom.trim() : "";
  const nom = typeof row.nom === "string" ? row.nom.trim() : "";
  if (prenom || nom) {
    return [prenom, nom].filter(Boolean).join(" ").trim();
  }

  const fallback = inferOptionValue<string | number>(row);
  return fallback == null ? "Option" : String(fallback);
}

function buildOptionFromRow<
  TValue extends string | number,
  TRow extends SelectRow = SelectRow,
>(
  row: TRow,
  mapper?: (row: TRow) => Option<TValue>,
  getOptionLabel?: (row: TRow) => string,
  getOptionValue?: (row: TRow) => TValue,
): Option<TValue> | null {
  if (mapper) {
    return mapper(row);
  }

  const value = getOptionValue?.(row) ?? inferOptionValue<TValue>(row);
  if (value == null) return null;

  const label = getOptionLabel?.(row) ?? inferOptionLabel(row);
  return {
    value,
    label,
  };
}

function filterOptions<TValue extends string | number>(
  options: Option<TValue>[],
  text: string,
) {
  const normalizedText = text.trim().toLowerCase();
  if (!normalizedText) return options;

  return options.filter((option) => {
    const normalizedLabel = option.label.toLowerCase();
    const normalizedValue = String(option.value).toLowerCase();
    return (
      normalizedLabel.includes(normalizedText) ||
      normalizedValue.includes(normalizedText)
    );
  });
}

function SelectFieldControl<
  TFieldValues extends FieldValues,
  TValue extends string | number,
  TRow extends SelectRow = SelectRow,
>({
  id,
  field,
  fieldState,
  label,
  description,
  disabled,
  required,
  className,
  options = [],
  emptyLabel = "Aucune selection",
  service,
  initialQuery,
  onSearchBuildWhere,
  mapOption,
  getOptionLabel,
  getOptionValue,
  searchPlaceholder = "Rechercher ou selectionner...",
  noResultsLabel = "Aucune option disponible.",
  loadingLabel = "Chargement...",
}: SelectFieldControlProps<TFieldValues, TValue, TRow>) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const optionCacheRef = React.useRef(new Map<string, Option<TValue>>());
  const baseQuery = React.useMemo<TableQuery>(
    () => ({
      page: 1,
      take: 10,
      ...(initialQuery ?? {}),
    }),
    [initialQuery],
  );

  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [remoteOptions, setRemoteOptions] = React.useState<Option<TValue>[]>(
    [],
  );
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [remoteError, setRemoteError] = React.useState<string | null>(null);

  const rememberOptions = React.useCallback((nextOptions: Option<TValue>[]) => {
    nextOptions.forEach((option) => {
      optionCacheRef.current.set(String(option.value), option);
    });
  }, []);

  const staticOptions = React.useMemo(() => uniqueOptions(options), [options]);

  React.useEffect(() => {
    rememberOptions(staticOptions);
  }, [rememberOptions, staticOptions]);

  const loadRemoteOptions = React.useCallback(
    async (
      queryOverride?: TableQuery,
      mode: "replace" | "merge" = "replace",
    ) => {
      if (!service) return;

      setLoadingOptions(true);
      setRemoteError(null);

      try {
        const response = await service.getAll(
          tableQueryToParams(queryOverride ?? baseQuery),
        );

        const nextOptions = uniqueOptions(
          extractRowsFromResponse(response).flatMap((row) => {
            const option = buildOptionFromRow<TValue, TRow>(
              row as TRow,
              mapOption,
              getOptionLabel,
              getOptionValue,
            );
            return option ? [option] : [];
          }),
        );

        rememberOptions(nextOptions);

        setRemoteOptions((current) =>
          mode === "merge"
            ? uniqueOptions([...current, ...nextOptions])
            : nextOptions,
        );
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Impossible de charger les options.";
        setRemoteError(message);
      } finally {
        setLoadingOptions(false);
      }
    },
    [
      baseQuery,
      getOptionLabel,
      getOptionValue,
      mapOption,
      rememberOptions,
      service,
    ],
  );

  React.useEffect(() => {
    if (!service) return;
    void loadRemoteOptions(baseQuery, "replace");
  }, [baseQuery, loadRemoteOptions, service]);

  const currentOptions = service ? remoteOptions : staticOptions;

  const selectedOption = React.useMemo(() => {
    if (field.value == null || field.value === "") return null;

    const cached = optionCacheRef.current.get(String(field.value));
    if (cached) return cached;

    return (
      currentOptions.find((option) =>
        areOptionValuesEqual(option.value, field.value as string | number),
      ) ?? null
    );
  }, [currentOptions, field.value]);

  React.useEffect(() => {
    if (!service) return;
    if (field.value == null || field.value === "") return;
    if (selectedOption) return;

    void loadRemoteOptions(
      {
        ...baseQuery,
        page: 1,
        take: 1,
        where: {
          ...(baseQuery.where ?? {}),
          id: field.value,
        },
      },
      "merge",
    );
  }, [baseQuery, field.value, loadRemoteOptions, selectedOption, service]);

  React.useEffect(() => {
    if (isOpen) return;
    setInputValue(selectedOption?.label ?? "");
    setSearchTerm("");
  }, [isOpen, selectedOption]);

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setInputValue(selectedOption?.label ?? "");
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen, selectedOption]);

  const visibleOptions = React.useMemo(
    () => filterOptions(currentOptions, searchTerm),
    [currentOptions, searchTerm],
  );

  const clearSelection = React.useCallback(() => {
    field.onChange(undefined);
    setInputValue("");
    setSearchTerm("");
    setIsOpen(true);
  }, [field]);

  const selectOption = React.useCallback(
    (option: Option<TValue>) => {
      field.onChange(option.value);
      setInputValue(option.label);
      setSearchTerm("");
      setIsOpen(false);
    },
    [field],
  );

  const handleRemoteSearch = React.useCallback(async () => {
    if (!service || !onSearchBuildWhere) return;

    const trimmedSearch = searchTerm.trim();
    const nextQuery: TableQuery = trimmedSearch
      ? {
          ...baseQuery,
          page: 1,
          where: onSearchBuildWhere(trimmedSearch),
        }
      : baseQuery;

    await loadRemoteOptions(nextQuery, "replace");
    setIsOpen(true);
  }, [baseQuery, loadRemoteOptions, onSearchBuildWhere, searchTerm, service]);

  return (
    <FieldWrapper
      id={id}
      label={label}
      description={description}
      required={required}
      error={fieldState.error?.message}
      className={className}
    >
      <div ref={containerRef} className="relative min-w-0 max-w-full space-y-2">
        <div className="relative">
          <input
            id={id}
            type="text"
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setSearchTerm(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (!disabled) {
                setIsOpen(true);
              }
            }}
            onBlur={field.onBlur}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (service && onSearchBuildWhere) {
                  void handleRemoteSearch();
                  return;
                }
                setIsOpen(true);
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setIsOpen(false);
                setInputValue(selectedOption?.label ?? "");
                setSearchTerm("");
              }
            }}
            ref={field.ref}
            disabled={disabled}
            placeholder={searchPlaceholder}
            className={`${getInputClassName(Boolean(fieldState.error))} ${
              field.value != null && field.value !== "" ? "pr-11" : ""
            }`}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={`${id}-listbox`}
            aria-autocomplete="list"
            autoComplete="off"
          />

          {field.value != null && field.value !== "" ? (
            <button
              type="button"
              onClick={clearSelection}
              disabled={disabled}
              aria-label="Effacer la selection"
              title="Effacer"
              className="absolute inset-y-1.5 right-2 inline-flex w-8 items-center justify-center rounded-xl text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              x
            </button>
          ) : null}
        </div>

        {isOpen ? (
          <div
            id={`${id}-listbox`}
            role="listbox"
            className={`${getSurfaceClassName(Boolean(fieldState.error))} absolute left-0 top-full z-20 mt-1 max-h-[min(18rem,calc(100vh-8rem))] w-full overflow-hidden`}
          >
            <div className="max-h-[min(18rem,calc(100vh-8rem))] overflow-y-auto py-2">
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  clearSelection();
                }}
                className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 sm:px-4 sm:py-2"
              >
                <span className="min-w-0 break-words">{emptyLabel}</span>
              </button>

              {loadingOptions ? (
                <div className="px-3 py-3 text-sm leading-5 text-slate-500 sm:px-4">
                  {loadingLabel}
                </div>
              ) : remoteError ? (
                <div className="px-3 py-3 text-sm leading-5 text-rose-600 sm:px-4">
                  {remoteError}
                </div>
              ) : visibleOptions.length === 0 ? (
                <div className="px-3 py-3 text-sm leading-5 text-slate-500 sm:px-4">
                  {noResultsLabel}
                </div>
              ) : (
                visibleOptions.map((option) => {
                  const isSelected = areOptionValuesEqual(
                    option.value,
                    field.value as string | number | undefined,
                  );

                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!option.disabled) {
                          selectOption(option);
                        }
                      }}
                      disabled={option.disabled}
                      aria-selected={isSelected}
                      className={`flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition sm:px-4 sm:py-2 ${
                        isSelected
                          ? "bg-sky-50 font-semibold text-sky-700"
                          : "text-slate-700 hover:bg-slate-50"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span className="min-w-0 break-words">
                        {option.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {service ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2">
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setInputValue(selectedOption?.label ?? "");
                    setSearchTerm("");
                    void loadRemoteOptions(baseQuery, "replace");
                  }}
                  className="min-h-9 flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900 sm:flex-none"
                >
                  Recharger
                </button>

                {onSearchBuildWhere ? (
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      void handleRemoteSearch();
                    }}
                    className="min-h-9 flex-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 sm:flex-none"
                  >
                    Chercher
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </FieldWrapper>
  );
}

export function SelectField<
  TFieldValues extends FieldValues,
  TValue extends string | number,
  TRow extends SelectRow = SelectRow,
>({ control, name, ...rest }: SelectFieldProps<TFieldValues, TValue, TRow>) {
  const id = String(name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SelectFieldControl
          {...rest}
          id={id}
          field={field}
          fieldState={fieldState}
        />
      )}
    />
  );
}
