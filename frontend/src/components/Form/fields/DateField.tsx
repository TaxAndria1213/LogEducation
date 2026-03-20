/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { Controller, type FieldValues } from "react-hook-form";
import { DayPicker } from "react-day-picker";
import { fr } from "date-fns/locale";
import "react-day-picker/dist/style.css";

import { formatDateWithLocalTimezone } from "../../../app/utils/functions";
import { FieldWrapper } from "./FieldWrapper";
import { getInputClassName, getSurfaceClassName } from "./inputStyles";
import type { BaseFieldProps } from "./types";

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

type DateFieldProps<TFieldValues extends FieldValues> = BaseFieldProps<TFieldValues> & {
  placeholder?: string;
  min?: string;
  max?: string;
  defaultValue?: string;
};

export function DateField<TFieldValues extends FieldValues>(
  props: DateFieldProps<TFieldValues>,
) {
  const id = String(props.name);
  const [open, setOpen] = React.useState(false);

  return (
    <Controller
      control={props.control}
      name={props.name}
      defaultValue={props.defaultValue as any}
      render={({ field, fieldState }) => {
        const currentValue = field.value ?? props.defaultValue;
        const selectedDate = parseIsoDate(currentValue);

        const minDate = parseIsoDate(props.min) ?? new Date(1950, 0, 1);
        const maxDate = parseIsoDate(props.max) ?? new Date(2035, 11, 31);

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
                type="button"
                id={id}
                onClick={() => !props.disabled && setOpen((v) => !v)}
                onBlur={field.onBlur}
                disabled={props.disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={`${getInputClassName(Boolean(fieldState.error))} flex min-h-12 items-center justify-between text-left`}
              >
                <span>
                  {selectedDate
                    ? formatDateWithLocalTimezone(
                        `${selectedDate.getFullYear()}-${String(
                          selectedDate.getMonth() + 1,
                        ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`,
                      ).date
                    : field.value
                      ? formatDateWithLocalTimezone(field.value).date
                      : props.placeholder ?? "Choisir une date"}
                </span>
                <span aria-hidden="true" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Calendrier
                </span>
              </button>

              {open && !props.disabled && (
                <div
                  role="dialog"
                  aria-label="Selecteur de date"
                  className={`${getSurfaceClassName(Boolean(fieldState.error))} absolute left-0 top-[calc(100%+8px)] z-[1000] min-w-[320px] p-3`}
                  style={{
                    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.14)",
                  }}
                >
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    month={selectedDate ?? undefined}
                    onSelect={(date) => {
                      field.onChange(toIsoDateString(date));
                      setOpen(false);
                    }}
                    locale={fr}
                    weekStartsOn={1}
                    captionLayout="dropdown"
                    navLayout="after"
                    startMonth={minDate}
                    endMonth={maxDate}
                    reverseYears
                    showOutsideDays
                    fixedWeeks
                  />

                  <div className="mt-3 flex justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        field.onChange(undefined);
                        setOpen(false);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Effacer
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        field.onChange(toIsoDateString(new Date()));
                        setOpen(false);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Aujourd'hui
                    </button>
                  </div>
                </div>
              )}
            </div>
          </FieldWrapper>
        );
      }}
    />
  );
}
