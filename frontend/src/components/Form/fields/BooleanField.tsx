import { Controller, type FieldValues } from "react-hook-form";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

export function BooleanField<TFieldValues extends FieldValues>(
  props: BaseFieldProps<TFieldValues>,
) {
  const id = String(props.name);

  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field, fieldState }) => {
        const isActive = field.value === true;

        return (
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
              aria-checked={isActive}
              onClick={() => field.onChange(!isActive)}
              onBlur={field.onBlur}
              disabled={props.disabled}
              className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left shadow-sm transition sm:min-h-12 sm:px-4 sm:py-3 ${
                fieldState.error
                  ? "border-rose-300 bg-rose-50"
                  : isActive
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              <span className="min-w-0 break-words text-base font-medium text-slate-700 sm:text-sm">
                {isActive ? "Active" : "Desactive"}
              </span>
              <span
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                  isActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                    isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </span>
            </button>
          </FieldWrapper>
        );
      }}
    />
  );
}
