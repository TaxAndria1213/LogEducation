/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { Controller, type FieldValues } from "react-hook-form";
import { DayPicker } from "react-day-picker";
import { fr } from "date-fns/locale";
import "react-day-picker/dist/style.css";

import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

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

function toIsoString(value: Date | string | number | undefined): string | undefined {
  const date = parseIsoDateTime(value);
  if (!date) return undefined;
  return date.toISOString();
}

function formatDisplayDateTime(date: Date | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "Choisir une date et une heure";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy} à ${hh}:${mi}`;
}

type DateTimeFieldProps<TFieldValues extends FieldValues> =
  BaseFieldProps<TFieldValues> & {
    placeholder?: string;
    min?: string;
    max?: string;
    defaultValue?: string;
    minuteStep?: number;
  };

export function DateTimeField<TFieldValues extends FieldValues>(
  props: DateTimeFieldProps<TFieldValues>,
) {
  console.log("🚀 ~ DateTimeField ~ props:", props)
  const id = String(props.name);
  const [open, setOpen] = React.useState(false);

  const minuteStep = props.minuteStep ?? 5;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from(
    { length: Math.floor(60 / minuteStep) },
    (_, i) => i * minuteStep,
  );

  return (
    <Controller
      control={props.control}
      name={props.name}
      defaultValue={props.defaultValue as any}
      render={({ field, fieldState }) => {
        const currentValue = field.value ?? props.defaultValue;
        const selectedDateTime = parseIsoDateTime(currentValue);

        const minDateTime = parseIsoDateTime(props.min);
        const maxDateTime = parseIsoDateTime(props.max);

        const selectedHour = selectedDateTime?.getHours() ?? 0;
        const selectedMinute = selectedDateTime?.getMinutes() ?? 0;

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
                  {selectedDateTime
                    ? formatDisplayDateTime(selectedDateTime)
                    : props.placeholder ?? "Choisir une date et une heure"}
                </span>
                <span aria-hidden="true">🕒</span>
              </button>

              {open && !props.disabled && (
                <div
                  role="dialog"
                  aria-label="Sélecteur de date et d’heure"
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
                    selected={selectedDateTime}
                    month={selectedDateTime ?? undefined}
                    onSelect={(date) => {
                      if (!date) {
                        field.onChange(undefined);
                        return;
                      }

                      updateDateTime(date, selectedHour, selectedMinute);
                    }}
                    locale={fr}
                    weekStartsOn={1}
                    captionLayout="dropdown"
                    navLayout="after"
                    startMonth={
                      minDateTime
                        ? new Date(minDateTime.getFullYear(), minDateTime.getMonth(), 1)
                        : new Date(1950, 0, 1)
                    }
                    endMonth={
                      maxDateTime
                        ? new Date(maxDateTime.getFullYear(), maxDateTime.getMonth(), 1)
                        : new Date(2035, 11, 1)
                    }
                    reverseYears
                    showOutsideDays
                    fixedWeeks
                  />

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label htmlFor={`${id}-hour`} style={{ fontSize: 12 }}>
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
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          background: "#fff",
                        }}
                      >
                        {hours.map((hour: number) => (
                          <option key={hour} value={hour}>
                            {String(hour).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label htmlFor={`${id}-minute`} style={{ fontSize: 12 }}>
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
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #ccc",
                          background: "#fff",
                        }}
                      >
                        {minutes.map((minute) => (
                          <option key={minute} value={minute}>
                            {String(minute).padStart(2, "0")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 12,
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
                        field.onChange(new Date().toISOString());
                        setOpen(false);
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        background: "#fff",
                      }}
                    >
                      Maintenant
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        background: "#fff",
                      }}
                    >
                      Valider
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
