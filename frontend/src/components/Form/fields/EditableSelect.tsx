import React from "react";
import { FieldWrapper } from "./FieldWrapper";
import { getInputClassName, getSurfaceClassName } from "./inputStyles";
import type { Option } from "./types";

type EditableSelectProps<TValue extends string | number = string> = {
  id?: string;
  value?: TValue | "";
  onChange: (value: TValue | "") => void;
  options?: Option<TValue>[];
  label?: string;
  description?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
  noResultsLabel?: string;
};

function areValuesEqual(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
) {
  if (left == null || right == null) return false;
  return String(left) === String(right);
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

export function EditableSelect<TValue extends string | number = string>({
  id = "editable-select",
  value = "",
  onChange,
  options = [],
  label,
  description,
  disabled,
  required,
  className,
  emptyLabel = "Aucune selection",
  searchPlaceholder = "Rechercher ou selectionner...",
  noResultsLabel = "Aucune option disponible.",
}: EditableSelectProps<TValue>) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const normalizedOptions = React.useMemo(
    () => uniqueOptions(options),
    [options],
  );
  const selectedOption = React.useMemo(
    () =>
      value === ""
        ? null
        : normalizedOptions.find((option) => areValuesEqual(option.value, value)) ??
          null,
    [normalizedOptions, value],
  );

  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(
    selectedOption?.label ?? "",
  );
  const [searchTerm, setSearchTerm] = React.useState("");

  React.useEffect(() => {
    if (isOpen) return;

    const nextInputValue = selectedOption?.label ?? "";
    setInputValue((current) =>
      current === nextInputValue ? current : nextInputValue,
    );
    setSearchTerm((current) => (current === "" ? current : ""));
  }, [isOpen, selectedOption?.label]);

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  const visibleOptions = React.useMemo(
    () => filterOptions(normalizedOptions, searchTerm),
    [normalizedOptions, searchTerm],
  );

  const clearSelection = React.useCallback(() => {
    onChange("");
    setInputValue((current) => (current === "" ? current : ""));
    setSearchTerm((current) => (current === "" ? current : ""));
    setIsOpen(true);
  }, [onChange]);

  const selectOption = React.useCallback(
    (option: Option<TValue>) => {
      onChange(option.value);
      setInputValue((current) =>
        current === option.label ? current : option.label,
      );
      setSearchTerm((current) => (current === "" ? current : ""));
      setIsOpen(false);
    },
    [onChange],
  );

  return (
    <FieldWrapper
      id={id}
      label={label}
      description={description}
      required={required}
      className={className}
    >
      <div ref={containerRef} className="relative min-w-0 max-w-full space-y-2">
        <div className="relative">
          <input
            id={id}
            type="text"
            value={inputValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              setInputValue((current) =>
                current === nextValue ? current : nextValue,
              );
              setSearchTerm((current) =>
                current === nextValue ? current : nextValue,
              );
              setIsOpen(true);
            }}
            onFocus={() => {
              if (!disabled) {
                setIsOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setIsOpen(false);
              }
            }}
            disabled={disabled}
            placeholder={searchPlaceholder}
            className={`${getInputClassName(false)} ${
              value !== "" ? "pr-11" : ""
            }`}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={`${id}-listbox`}
            aria-autocomplete="list"
            autoComplete="off"
          />

          {value !== "" ? (
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
            className={`${getSurfaceClassName(false)} absolute left-0 top-full z-20 mt-1 max-h-[min(18rem,calc(100vh-8rem))] w-full overflow-hidden`}
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

              {visibleOptions.length === 0 ? (
                <div className="px-3 py-3 text-sm leading-5 text-slate-500 sm:px-4">
                  {noResultsLabel}
                </div>
              ) : (
                visibleOptions.map((option) => {
                  const isSelected = areValuesEqual(option.value, value);

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
          </div>
        ) : null}
      </div>
    </FieldWrapper>
  );
}
