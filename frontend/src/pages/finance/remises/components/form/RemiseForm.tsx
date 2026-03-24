import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import RemiseService from "../../../../../services/remise.service";

const schema = z.object({
  nom: z.string().trim().min(2, "Le nom est requis."),
  type: z.enum(["PERCENT", "FIXED"]),
  valeur: z.coerce.number().min(0, "La valeur doit etre positive ou nulle."),
  regles_json: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "La remise n'a pas pu etre enregistree.";
}

export default function RemiseForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new RemiseService(), []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nom: "",
      type: "PERCENT",
      valeur: 0,
      regles_json: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await service.create({
        etablissement_id,
        nom: data.nom,
        type: data.type,
        valeur: data.valeur,
        regles_json: data.regles_json?.trim() ? data.regles_json : null,
      });
      info("Remise creee avec succes !", "success");
      form.reset({
        nom: "",
        type: "PERCENT",
        valeur: 0,
        regles_json: "",
      });
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Nouvelle remise</h2>
        <p className="mt-2 text-sm text-slate-500">Prepare une reduction reutilisable, en pourcentage ou en montant fixe, avec des regles JSON optionnelles.</p>
      </section>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <Controller control={form.control} name="nom" render={({ field, fieldState }) => <FieldWrapper id="nom" label="Nom" required error={fieldState.error?.message}><input {...field} className={getInputClassName(Boolean(fieldState.error))} placeholder="Ex: Remise fratrie" /></FieldWrapper>} />
        <Controller control={form.control} name="type" render={({ field, fieldState }) => <FieldWrapper id="type" label="Type" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="PERCENT">Pourcentage</option><option value="FIXED">Montant fixe</option></select></FieldWrapper>} />
        <Controller control={form.control} name="valeur" render={({ field, fieldState }) => <FieldWrapper id="valeur" label="Valeur" required error={fieldState.error?.message}><input type="number" min={0} step="0.01" {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <div className="hidden md:block" />
        <Controller control={form.control} name="regles_json" render={({ field, fieldState }) => <div className="md:col-span-2"><FieldWrapper id="regles_json" label="Regles JSON" error={fieldState.error?.message}><textarea {...field} rows={5} className={getInputClassName(Boolean(fieldState.error))} placeholder='Ex: {"service":"fratrie","minimum_enfants":2}' /></FieldWrapper></div>} />
        <div className="md:col-span-2 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Enregistrer</button></div>
      </form>
    </div>
  );
}
