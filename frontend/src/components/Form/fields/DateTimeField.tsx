/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { createPortal } from "react-dom";
import { Controller, type FieldValues } from "react-hook-form";
import { DayPicker } from "react-day-picker";
import { fr } from "date-fns/locale";
import "react-day-picker/dist/style.css";

import { FieldWrapper } from "./FieldWrapper";
import { getInputClassName, getSurfaceClassName } from "./inputStyles";
import type { BaseFieldProps } from "./types";

const MONTH_LABELS = [
  "Janvier",
  "Fevrier",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Decembre",
];

function parseIsoDateTime(value: unknown): Date | undefined {
  if (!value) return undefined;

  // Accepte les Date, string ISO, ou timestamp numérique
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

function toIsoString(
  value: Date | string | number | undefined,
): string | undefined {
  const date = parseIsoDateTime(value);
  if (!date) return undefined;
  return date.toISOString();
}

function clampMonthToRange(month: Date, minMonth: Date, maxMonth: Date) {
  const next = new Date(month.getFullYear(), month.getMonth(), 1);

  if (next < minMonth) return minMonth;
  if (next > maxMonth) return maxMonth;
  return next;
}

function formatDisplayDateTime(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime()))
    return "Choisir une date et une heure";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy} à ${hh}:${mi}`;
}

const POPOVER_MARGIN = 12;
const POPOVER_GAP = 8;

function getViewportPopoverStyle(
  trigger: HTMLElement,
  popover: HTMLElement | null,
  minWidth: number,
): React.CSSProperties {
  if (typeof window === "undefined") {
    return {};
  }

  const triggerRect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxAvailableWidth = Math.max(0, viewportWidth - POPOVER_MARGIN * 2);
  const width = Math.min(
    Math.max(triggerRect.width, minWidth),
    maxAvailableWidth,
  );
  const measuredHeight = popover?.offsetHeight ?? 0;
  const estimatedHeight = measuredHeight || 470;
  const spaceBelow =
    viewportHeight - triggerRect.bottom - POPOVER_GAP - POPOVER_MARGIN;
  const spaceAbove = triggerRect.top - POPOVER_GAP - POPOVER_MARGIN;
  const shouldOpenAbove =
    estimatedHeight > spaceBelow && spaceAbove > spaceBelow;
  const rawTop = shouldOpenAbove
    ? triggerRect.top - estimatedHeight - POPOVER_GAP
    : triggerRect.bottom + POPOVER_GAP;
  const top = Math.min(
    Math.max(rawTop, POPOVER_MARGIN),
    Math.max(POPOVER_MARGIN, viewportHeight - estimatedHeight - POPOVER_MARGIN),
  );
  const left = Math.min(
    Math.max(triggerRect.left, POPOVER_MARGIN),
    Math.max(POPOVER_MARGIN, viewportWidth - width - POPOVER_MARGIN),
  );

  return {
    position: "fixed",
    top,
    left,
    width,
    boxSizing: "border-box",
    maxWidth: maxAvailableWidth,
    maxHeight: Math.max(220, viewportHeight - POPOVER_MARGIN * 2),
    overflowY: "auto",
    overflowX: "hidden",
  };
}

function arePopoverStylesEqual(
  current: React.CSSProperties,
  next: React.CSSProperties,
) {
  return (
    current.position === next.position &&
    current.top === next.top &&
    current.left === next.left &&
    current.width === next.width &&
    current.boxSizing === next.boxSizing &&
    current.maxWidth === next.maxWidth &&
    current.maxHeight === next.maxHeight &&
    current.overflowY === next.overflowY &&
    current.overflowX === next.overflowX
  );
}

type DateTimeFieldProps<TFieldValues extends FieldValues> =
  BaseFieldProps<TFieldValues> & {
    placeholder?: string;
    min?: string;
    max?: string;
    defaultValue?: string;
    minuteStep?: number;
  };

type DateTimeFieldControlProps<TFieldValues extends FieldValues> =
  DateTimeFieldProps<TFieldValues> & {
    id: string;
    field: {
      value: unknown;
      onChange: (value: unknown) => void;
      onBlur: () => void;
      ref: React.Ref<HTMLElement>;
    };
    fieldState: {
      error?: { message?: string };
    };
  };

function DateTimeFieldControl<TFieldValues extends FieldValues>({
  id,
  field,
  fieldState,
  ...props
}: DateTimeFieldControlProps<TFieldValues>) {
  const [open, setOpen] = React.useState(false);
  const [viewMonth, setViewMonth] = React.useState<Date | undefined>(undefined);
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>(
    {},
  );
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const minuteStep = props.minuteStep ?? 5;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from(
    { length: Math.floor(60 / minuteStep) },
    (_, i) => i * minuteStep,
  );
  const currentValue = field.value ?? props.defaultValue;
  const selectedDateTime = parseIsoDateTime(currentValue);
  const minDateTime = React.useMemo(
    () => parseIsoDateTime(props.min),
    [props.min],
  );
  const maxDateTime = React.useMemo(
    () => parseIsoDateTime(props.max),
    [props.max],
  );
  const minMonth = React.useMemo(
    () =>
      minDateTime
        ? new Date(minDateTime.getFullYear(), minDateTime.getMonth(), 1)
        : new Date(1950, 0, 1),
    [minDateTime],
  );
  const maxMonth = React.useMemo(
    () =>
      maxDateTime
        ? new Date(maxDateTime.getFullYear(), maxDateTime.getMonth(), 1)
        : new Date(2035, 11, 1),
    [maxDateTime],
  );
  const defaultMonth = clampMonthToRange(new Date(), minMonth, maxMonth);
  const currentCalendarMonth = clampMonthToRange(
    viewMonth ?? selectedDateTime ?? defaultMonth,
    minMonth,
    maxMonth,
  );
  const currentCalendarYear = currentCalendarMonth.getFullYear();
  const currentCalendarMonthKey = `${currentCalendarYear}-${currentCalendarMonth.getMonth()}`;
  const selectedHour = selectedDateTime?.getHours() ?? 0;
  const selectedMinute = selectedDateTime?.getMinutes() ?? 0;
  const [yearInput, setYearInput] = React.useState(String(currentCalendarYear));

  React.useEffect(() => {
    setYearInput(String(currentCalendarYear));
  }, [currentCalendarYear]);

  const updatePopoverPosition = React.useCallback(() => {
    if (!open || !triggerRef.current) return;
    const nextStyle = getViewportPopoverStyle(
      triggerRef.current,
      popoverRef.current,
      320,
    );

    setPopoverStyle((currentStyle) =>
      arePopoverStylesEqual(currentStyle, nextStyle) ? currentStyle : nextStyle,
    );
  }, [open]);

  React.useLayoutEffect(() => {
    updatePopoverPosition();
  }, [currentCalendarMonthKey, open, updatePopoverPosition]);

  React.useEffect(() => {
    if (!open) return undefined;

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  React.useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;

      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  const applyMonth = React.useCallback(
    (nextMonth: Date) => {
      setViewMonth(clampMonthToRange(nextMonth, minMonth, maxMonth));
    },
    [maxMonth, minMonth],
  );

  const applyYearInput = React.useCallback(() => {
    const parsedYear = Number.parseInt(yearInput, 10);
    if (!Number.isFinite(parsedYear)) {
      setYearInput(String(currentCalendarYear));
      return;
    }

    applyMonth(new Date(parsedYear, currentCalendarMonth.getMonth(), 1));
  }, [applyMonth, currentCalendarMonth, currentCalendarYear, yearInput]);

  const updateDateTime = (
    datePart: Date | undefined,
    hour: number,
    minute: number,
  ) => {
    if (!datePart) {
      field.onChange(undefined);
      return;
    }

    const next = new Date(
      datePart.getFullYear(),
      datePart.getMonth(),
      datePart.getDate(),
      hour,
      minute,
      0,
      0,
    );

    field.onChange(toIsoString(next));
  };

  const popoverContent =
    open && !props.disabled ? (
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Selecteur de date et d'heure"
        className={`${getSurfaceClassName(Boolean(fieldState.error))} z-[1000] p-2 sm:p-3`}
        style={{
          ...popoverStyle,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.14)",
        }}
      >
        <style>{`
              #${id}-picker {
                --rdp-day_button-width: 2rem;
                --rdp-day_button-height: 2rem;
                --rdp-day-width: 2.15rem;
                --rdp-day-height: 2.15rem;
                --rdp-nav_button-width: 2rem;
                --rdp-nav_button-height: 2rem;
                --rdp-nav-height: 2.2rem;
                font-size: 0.84rem;
              }
              #${id}-picker .rdp-month_caption,
              #${id}-picker .rdp-nav {
                display: none;
              }
              #${id}-picker .rdp-weekday {
                font-size: 0.68rem;
                font-weight: 600;
              }
              #${id}-picker .rdp-day_button {
                font-size: 0.78rem;
              }
              #${id}-picker,
              #${id}-picker .rdp-months,
              #${id}-picker .rdp-month {
                width: 100%;
                max-width: 100%;
              }
            `}</style>

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Mois</label>
              <select
                value={currentCalendarMonth.getMonth()}
                onChange={(event) => {
                  applyMonth(
                    new Date(
                      currentCalendarYear,
                      Number(event.target.value),
                      1,
                    ),
                  );
                }}
                className={getInputClassName(Boolean(fieldState.error))}
              >
                {MONTH_LABELS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 space-y-1.5 sm:w-28">
              <label className="text-xs font-medium text-slate-600">
                Annee
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={yearInput}
                min={minMonth.getFullYear()}
                max={maxMonth.getFullYear()}
                onChange={(event) => setYearInput(event.target.value)}
                onBlur={applyYearInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyYearInput();
                  }
                }}
                className={getInputClassName(Boolean(fieldState.error))}
              />
            </div>
          </div>
        </div>

        <DayPicker
          id={`${id}-picker`}
          mode="single"
          selected={selectedDateTime}
          month={currentCalendarMonth}
          onMonthChange={applyMonth}
          onSelect={(date) => {
            if (!date) {
              field.onChange(undefined);
              return;
            }

            updateDateTime(date, selectedHour, selectedMinute);
            applyMonth(date);
          }}
          locale={fr}
          weekStartsOn={1}
          captionLayout="label"
          navLayout="after"
          startMonth={minMonth}
          endMonth={maxMonth}
          showOutsideDays
          fixedWeeks
          className="custom-date-picker"
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor={`${id}-hour`}
              className="text-xs font-medium text-slate-600"
            >
              Heure
            </label>
            <select
              id={`${id}-hour`}
              value={selectedHour}
              onChange={(e) => {
                const hour = Number(e.target.value);
                updateDateTime(
                  selectedDateTime ?? new Date(),
                  hour,
                  selectedMinute,
                );
              }}
              className={getInputClassName(Boolean(fieldState.error))}
            >
              {hours.map((hour: number) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor={`${id}-minute`}
              className="text-xs font-medium text-slate-600"
            >
              Minute
            </label>
            <select
              id={`${id}-minute`}
              value={selectedMinute - (selectedMinute % minuteStep)}
              onChange={(e) => {
                const minute = Number(e.target.value);
                updateDateTime(
                  selectedDateTime ?? new Date(),
                  selectedHour,
                  minute,
                );
              }}
              className={getInputClassName(Boolean(fieldState.error))}
            >
              {minutes.map((minute) => (
                <option key={minute} value={minute}>
                  {String(minute).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={() => {
              field.onChange(undefined);
              setOpen(false);
            }}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Effacer
          </button>

          <button
            type="button"
            onClick={() => {
              const now = new Date();
              field.onChange(now.toISOString());
              setViewMonth(now);
              setOpen(false);
            }}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Maintenant
          </button>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Valider
          </button>
        </div>
      </div>
    ) : null;

  return (
    <FieldWrapper
      id={id}
      label={props.label}
      description={props.description}
      required={props.required}
      error={fieldState.error?.message}
      className={props.className}
    >
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          onClick={() => {
            if (props.disabled) return;
            setOpen((currentOpen) => {
              const nextOpen = !currentOpen;
              if (nextOpen) {
                setViewMonth(selectedDateTime ?? defaultMonth);
              }
              return nextOpen;
            });
          }}
          onBlur={field.onBlur}
          disabled={props.disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`${getInputClassName(Boolean(fieldState.error))} inline-flex items-center justify-between gap-3 text-left`}
        >
          <span className="min-w-0 truncate">
            {selectedDateTime
              ? formatDisplayDateTime(selectedDateTime)
              : (props.placeholder ?? "Choisir une date et une heure")}
          </span>
          <span
            aria-hidden="true"
            className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 sm:inline"
          >
            Heure
          </span>
        </button>
      </div>
      {popoverContent && typeof document !== "undefined"
        ? createPortal(popoverContent, document.body)
        : popoverContent}
    </FieldWrapper>
  );
}

export function DateTimeField<TFieldValues extends FieldValues>(
  props: DateTimeFieldProps<TFieldValues>,
) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
      defaultValue={props.defaultValue as any}
      render={({ field, fieldState }) => (
        <DateTimeFieldControl
          {...props}
          id={id}
          field={field}
          fieldState={fieldState}
        />
      )}
    />
  );
}
