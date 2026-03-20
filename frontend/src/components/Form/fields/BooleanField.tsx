import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function BooleanField<TFieldValues extends FieldValues>(props: BaseFieldProps<TFieldValues>) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          id={id}
          label={props.label}
          description={props.description}
          required={props.required}
          error={fieldState.error?.message}
          className={props.className}
        >
          <button
            id={id}
            type="button"
            role="switch"
            aria-checked={Boolean(field.value)}
            onClick={() => field.onChange(!Boolean(field.value))}
            onBlur={field.onBlur}
            disabled={props.disabled}
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
              fieldState.error
                ? "border-rose-300 bg-rose-50"
                : Boolean(field.value)
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="text-sm font-medium text-slate-700">
              {Boolean(field.value) ? "Active" : "Desactive"}
            </span>
            <span
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                Boolean(field.value) ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                  Boolean(field.value) ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>
        </FieldWrapper>
      )}
    />
  );
}
