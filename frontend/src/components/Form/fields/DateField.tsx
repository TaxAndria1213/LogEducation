/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { Controller, type FieldValues } from "react-hook-form";
import { DayPicker } from "react-day-picker";
import { fr } from "date-fns/locale";
import "react-day-picker/dist/style.css";

import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";
import { formatDateWithLocalTimezone } from "../../../app/utils/functions";

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

type DateFieldProps<TFieldValues extends FieldValues> =
  BaseFieldProps<TFieldValues> & {
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
        console.log(field);
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
            <div style={{ position: "relative" }}>
              <button
                type="button"
                id={id}
                onClick={() => !props.disabled && setOpen((v) => !v)}
                onBlur={field.onBlur}
                disabled={props.disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                style={{
                  width: "100%",
                  minHeight: 44,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: fieldState.error
                    ? "1px solid #d32f2f"
                    : "1px solid #ccc",
                  background: props.disabled ? "#f5f5f5" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: props.disabled ? "not-allowed" : "pointer",
                  textAlign: "left",
                }}
              >
                <span>
                  {selectedDate
                    ? formatDateWithLocalTimezone(selectedDate.getFullYear() +
                      "-" +
                      (selectedDate.getMonth() + 1)
                        .toString()
                        .padStart(2, "0") +
                      "-" +
                      selectedDate.getDate().toString().padStart(2, "0")).date
                    : field.value
                      ? formatDateWithLocalTimezone(field.value).date
                      : "Choisir une date"}
                </span>
                <span aria-hidden="true">📅</span>
              </button>

              {open && !props.disabled && (
                <div
                  role="dialog"
                  aria-label="Sélecteur de date"
                  style={{
                    position: "absolute",
                    zIndex: 1000,
                    top: "calc(100% + 8px)",
                    left: 0,
                    background: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                    padding: 12,
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

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        field.onChange(undefined);
                        setOpen(false);
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        background: "#fff",
                      }}
                    >
                      Effacer
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        field.onChange(toIsoDateString(new Date()));
                        setOpen(false);
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        background: "#fff",
                      }}
                    >
                      Aujourd’hui
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
