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
}: {
  schema: any;
  fields: any[];
  service?: ServiceLike | null;
  labelMessage: string;
  dataOnly?: (data: FormValues) => void | Promise<void>;
  initialValues?: Partial<FormValues>;
}) {
  const [loading, setLoading] = useState(false);

  // ⚠️ important: stable reference, sinon RHF peut se réinitialiser
  const defaultValues = useMemo(() => {
    const autoDefaults = Object.fromEntries(
      fields.map((f: any) => [f.name, f.nullable ? null : undefined]),
    );

    return {
      ...autoDefaults,
      ...(initialValues ?? {}),
    };
  }, [fields, initialValues]);

  const { info } = useInfo();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
  });

  const onValid = async (data: FormValues) => {
    setLoading(true);
    try {
      // ✅ mode "data only"
      if (dataOnly) {
        await dataOnly(data);
        return;
      }

      // ✅ mode "service" (optionnel)
      if (!service) {
        console.warn("Form: service is null/undefined and no dataOnly provided.");
        return;
      }

      const result = await service.create(data);
      console.log("🚀 ~ onValid ~ result:", result);
      info(`${labelMessage} créé avec succès !`, "success");
      // optionnel : reset après succès
      // form.reset(defaultValues);
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
      style={{ display: "grid", gap: 12 }}
    >
      {fields.map(({ name, label, Component, props, required }: any) => (
        <Component
          key={String(name)}
          control={form.control}
          name={name}
          label={label}
          required={required}
          {...(props ?? {})}
        />
      ))}

      <button
        type="submit"
        disabled={loading}
        className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center gap-2"
        style={{ justifySelf: "start" }}
      >
        <span>Enregistrer</span>
        {loading ? <Spin inline /> : null}
      </button>
    </form>
  );
}