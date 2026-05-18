/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type z from "zod";
import Spin from "../anim/Spin";
import { useInfo } from "../../hooks/useInfo";

type FormValues = z.infer<any>;

type ServiceLike = {
  create: (data: any) => Promise<any>;
};

export function Form({
  schema,
  fields,
  service,
  dataOnly,
  initialValues,
  submitLabel = "Enregistrer",
  submitAlign = "start",
  onValuesChange,
  syncValues,
  cancelLabel = "Annuler",
  onCancel,
}: {
  schema: any;
  fields: any[];
  service?: ServiceLike | null;
  labelMessage: string;
  dataOnly?: (data: FormValues) => void | Promise<void>;
  initialValues?: Partial<FormValues>;
  submitLabel?: string;
  submitAlign?: "start" | "end";
  onValuesChange?: (data: Partial<FormValues>) => void;
  syncValues?: Partial<FormValues>;
  cancelLabel?: string;
  onCancel?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { info } = useInfo();
  const onValuesChangeRef = useRef(onValuesChange);
  const lastSyncValuesRef = useRef("");
  const defaultValues = useMemo(() => {
    const autoDefaults = Object.fromEntries(
      fields.map((f: any) => [f.name, f.nullable ? null : undefined]),
    );

    return {
      ...autoDefaults,
      ...(initialValues ?? {}),
    };
  }, [fields, initialValues]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  }, [onValuesChange]);

  useEffect(() => {
    if (!onValuesChangeRef.current) return undefined;
    onValuesChangeRef.current(form.getValues());
    const subscription = form.watch((value) => {
      onValuesChangeRef.current?.(value as Partial<FormValues>);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (!syncValues) return;
    const syncSignature = JSON.stringify(syncValues);
    if (syncSignature === lastSyncValuesRef.current) return;
    lastSyncValuesRef.current = syncSignature;

    Object.entries(syncValues).forEach(([key, value]) => {
      form.setValue((key as keyof FormValues) as string, value as FormValues[keyof FormValues], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    });
  }, [form, syncValues]);

  const onValid = async (data: FormValues) => {
    setLoading(true);
    try {
      if (dataOnly) {
        try {
          await dataOnly(data);
        } catch (error) {
          console.log(error);
          info(error, "error");
        }
        return;
      }

      if (!service) {
        console.error("Form: service is null/undefined and no dataOnly provided.");
        return;
      }

      const result = await service.create(data);
      info(result, "success");
      form.reset(defaultValues);
    } catch (error) {
      info(error, "error");
    } finally {
      setLoading(false);
    }
  };

  const onInvalid = (errors: any) => {
    console.log("Form invalid:", errors);
    setLoading(false);
  };

  return (
    <form
      onSubmit={form.handleSubmit(onValid, onInvalid)}
      className="grid gap-6"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {fields.map(({ name, label, Component, props, required }: any) => {
          return (
            <Component
              key={String(name)}
              control={form.control}
              name={name}
              label={label}
              required={required}
              {...(props ?? {})}
            />
          );
        })}
      </div>

      <div
        className={`flex flex-wrap gap-3 ${
          submitAlign === "end" ? "justify-end" : "justify-start"
        }`}
      >
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span>{cancelLabel}</span>
          </button>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span>{submitLabel}</span>
          {loading ? <Spin inline /> : null}
        </button>
      </div>
    </form>
  );
}
