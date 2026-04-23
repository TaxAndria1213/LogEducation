/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { createPortal } from "react-dom";
import { Controller, type FieldValues } from "react-hook-form";
import { DayPicker } from "react-day-picker";
import { fr } from "date-fns/locale";
import "react-day-picker/dist/style.css";

import { formatDateWithLocalTimezone } from "../../../app/utils/functions";
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

function parseIsoDate(value: unknown): Date | undefined {
  if (!value || typeof value !== "string") return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));

  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(m) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return undefined;
  }

  return date;
}

function toIsoDateString(date: Date | undefined): string | undefined {
  if (!date || Number.isNaN(date.getTime())) return undefined;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clampMonthToRange(month: Date, minDate: Date, maxDate: Date) {
  const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  const next = new Date(month.getFullYear(), month.getMonth(), 1);

  if (next < start) return start;
  if (next > end) return end;
  return next;
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
  const estimatedHeight = measuredHeight || 370;
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
    maxHeight: Math.max(180, viewportHeight - POPOVER_MARGIN * 2),
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

type DateFieldProps<TFieldValues extends FieldValues> =
  BaseFieldProps<TFieldValues> & {
    placeholder?: string;
    min?: string;
    max?: string;
    defaultValue?: string;
  };

type DateFieldControlProps<TFieldValues extends FieldValues> =
  DateFieldProps<TFieldValues> & {
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

function DateFieldControl<TFieldValues extends FieldValues>({
  id,
  field,
  fieldState,
  ...props
}: DateFieldControlProps<TFieldValues>) {
  const [open, setOpen] = React.useState(false);
  const [viewMonth, setViewMonth] = React.useState<Date | undefined>(undefined);
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>(
    {},
  );
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const currentValue = field.value ?? props.defaultValue;
  const selectedDate = parseIsoDate(currentValue);
  const minDate = React.useMemo(
    () => parseIsoDate(props.min) ?? new Date(1950, 0, 1),
    [props.min],
  );
  const maxDate = React.useMemo(
    () => parseIsoDate(props.max) ?? new Date(2035, 11, 31),
    [props.max],
  );
  const today = new Date();
  const defaultMonth = clampMonthToRange(today, minDate, maxDate);
  const currentCalendarMonth = clampMonthToRange(
    viewMonth ?? selectedDate ?? defaultMonth,
    minDate,
    maxDate,
  );
  const currentCalendarYear = currentCalendarMonth.getFullYear();
  const currentCalendarMonthKey = `${currentCalendarYear}-${currentCalendarMonth.getMonth()}`;
  const [yearInput, setYearInput] = React.useState(String(currentCalendarYear));

  React.useEffect(() => {
    setYearInput(String(currentCalendarYear));
  }, [currentCalendarYear]);

  const updatePopoverPosition = React.useCallback(() => {
    if (!open || !triggerRef.current) return;
    const nextStyle = getViewportPopoverStyle(
      triggerRef.current,
      popoverRef.current,
      296,
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
      setViewMonth(clampMonthToRange(nextMonth, minDate, maxDate));
    },
    [maxDate, minDate],
  );

  const applyYearInput = React.useCallback(() => {
    const parsedYear = Number.parseInt(yearInput, 10);
    if (!Number.isFinite(parsedYear)) {
      setYearInput(String(currentCalendarYear));
      return;
    }

    applyMonth(new Date(parsedYear, currentCalendarMonth.getMonth(), 1));
  }, [applyMonth, currentCalendarMonth, currentCalendarYear, yearInput]);

  const popoverContent =
    open && !props.disabled ? (
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Selecteur de date"
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
                min={minDate.getFullYear()}
                max={maxDate.getFullYear()}
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
          selected={selectedDate}
          month={currentCalendarMonth}
          onMonthChange={applyMonth}
          onSelect={(date) => {
            field.onChange(toIsoDateString(date));
            applyMonth(date ?? selectedDate ?? defaultMonth);
            setOpen(false);
          }}
          locale={fr}
          weekStartsOn={1}
          captionLayout="label"
          navLayout="after"
          startMonth={minDate}
          endMonth={maxDate}
          showOutsideDays
          fixedWeeks
          className="custom-date-picker"
        />

        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:gap-3">
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
              const today = new Date();
              field.onChange(toIsoDateString(today));
              setViewMonth(today);
              setOpen(false);
            }}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Aujourd'hui
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
                setViewMonth(selectedDate ?? defaultMonth);
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
            {selectedDate
              ? formatDateWithLocalTimezone(
                  `${selectedDate.getFullYear()}-${String(
                    selectedDate.getMonth() + 1,
                  ).padStart(
                    2,
                    "0",
                  )}-${String(selectedDate.getDate()).padStart(2, "0")}`,
                ).date
              : field.value
                ? formatDateWithLocalTimezone(field.value as string).date
                : (props.placeholder ?? "Choisir une date")}
          </span>
          <span
            aria-hidden="true"
            className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 sm:inline"
          >
            Calendrier
          </span>
        </button>
      </div>
      {popoverContent && typeof document !== "undefined"
        ? createPortal(popoverContent, document.body)
        : popoverContent}
    </FieldWrapper>
  );
}

export function DateField<TFieldValues extends FieldValues>(
  props: DateFieldProps<TFieldValues>,
) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
      defaultValue={props.defaultValue as any}
      render={({ field, fieldState }) => {
        return (
          <DateFieldControl
            {...props}
            id={id}
            field={field}
            fieldState={fieldState}
          />
        );
      }}
    />
  );
}
