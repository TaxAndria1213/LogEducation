/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
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
  labelMessage,
  dataOnly,
  initialValues,
  submitLabel = "Enregistrer",
  submitAlign = "start",
}: {
  schema: any;
  fields: any[];
  service?: ServiceLike | null;
  labelMessage: string;
  dataOnly?: (data: FormValues) => void | Promise<void>;
  initialValues?: Partial<FormValues>;
  submitLabel?: string;
  submitAlign?: "start" | "end";
}) {
  const [loading, setLoading] = useState(false);
  const { info } = useInfo();

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

  const onValid = async (data: FormValues) => {
    setLoading(true);
    try {
      if (dataOnly) {
        try {
          await dataOnly(data);
        } catch (error) {
          console.log(error);
          info(`${labelMessage} non cree(e) !`, "error");
        }
        return;
      }

      if (!service) {
        console.error("Form: service is null/undefined and no dataOnly provided.");
        return;
      }

      await service.create(data);
      info(`${labelMessage} cree(e) avec succes !`, "success");
      form.reset(defaultValues);
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

      <div className={`flex ${submitAlign === "end" ? "justify-end" : "justify-start"}`}>
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
