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
  categorie: z.enum([
    "REMISE_EXCEPTIONNELLE",
    "EXONERATION_PARTIELLE",
    "EXONERATION_TOTALE",
    "BOURSE",
    "PRISE_EN_CHARGE",
  ]),
  valeur: z.coerce.number().min(0, "La valeur doit etre positive ou nulle."),
  tiers_label: z.string().optional(),
  justificatif_obligatoire: z.boolean().default(false),
  justificatif_reference: z.string().optional(),
  justificatif_url: z.string().optional(),
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
      categorie: "REMISE_EXCEPTIONNELLE",
      valeur: 0,
      tiers_label: "",
      justificatif_obligatoire: false,
      justificatif_reference: "",
      justificatif_url: "",
      regles_json: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const userRules = data.regles_json?.trim()
        ? (JSON.parse(data.regles_json) as Record<string, unknown>)
        : {};
      const regles = {
        ...userRules,
        nature_financiere: data.categorie,
        justificatif_obligatoire: data.justificatif_obligatoire,
        justificatif_reference: data.justificatif_reference?.trim() || null,
        justificatif_url: data.justificatif_url?.trim() || null,
        ...(data.categorie === "EXONERATION_TOTALE"
          ? { plafond_exoneration: "TOTAL" }
          : {}),
        ...(data.categorie === "BOURSE" || data.categorie === "PRISE_EN_CHARGE"
          ? {
              tiers: data.tiers_label?.trim()
                ? [{ libelle: data.tiers_label.trim() }]
                : userRules.tiers ?? [],
            }
          : {}),
      };
      await service.create({
        etablissement_id,
        nom: data.nom,
        type: data.type,
        valeur: data.valeur,
        regles_json: regles,
      });
      info("Remise creee avec succes !", "success");
      form.reset({
        nom: "",
        type: "PERCENT",
        categorie: "REMISE_EXCEPTIONNELLE",
        valeur: 0,
        tiers_label: "",
        justificatif_obligatoire: false,
        justificatif_reference: "",
        justificatif_url: "",
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
        <Controller control={form.control} name="categorie" render={({ field, fieldState }) => <FieldWrapper id="categorie" label="Categorie metier" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="REMISE_EXCEPTIONNELLE">Remise exceptionnelle</option><option value="EXONERATION_PARTIELLE">Exoneration partielle</option><option value="EXONERATION_TOTALE">Exoneration totale</option><option value="BOURSE">Bourse</option><option value="PRISE_EN_CHARGE">Prise en charge</option></select></FieldWrapper>} />
        <Controller control={form.control} name="valeur" render={({ field, fieldState }) => <FieldWrapper id="valeur" label="Valeur" required error={fieldState.error?.message}><input type="number" min={0} step="0.01" {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="tiers_label" render={({ field, fieldState }) => <FieldWrapper id="tiers_label" label="Tiers payeur / organisme" error={fieldState.error?.message}><input {...field} className={getInputClassName(Boolean(fieldState.error))} placeholder="Ex: Bourse ministerielle" /></FieldWrapper>} />
        <Controller control={form.control} name="justificatif_obligatoire" render={({ field }) => <div className="md:col-span-2"><label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />Justificatif obligatoire pour cette remise</label></div>} />
        <Controller control={form.control} name="justificatif_reference" render={({ field, fieldState }) => <FieldWrapper id="justificatif_reference" label="Reference justificatif" error={fieldState.error?.message}><input {...field} className={getInputClassName(Boolean(fieldState.error))} placeholder="Ex: DECISION-2026-014" /></FieldWrapper>} />
        <Controller control={form.control} name="justificatif_url" render={({ field, fieldState }) => <FieldWrapper id="justificatif_url" label="URL / chemin justificatif" error={fieldState.error?.message}><input {...field} className={getInputClassName(Boolean(fieldState.error))} placeholder="Ex: /documents/remises/decision-014.pdf" /></FieldWrapper>} />
        <Controller control={form.control} name="regles_json" render={({ field, fieldState }) => <div className="md:col-span-2"><FieldWrapper id="regles_json" label="Regles JSON" error={fieldState.error?.message}><textarea {...field} rows={5} className={getInputClassName(Boolean(fieldState.error))} placeholder='Ex: {"service":"fratrie","minimum_enfants":2}' /></FieldWrapper></div>} />
        <div className="md:col-span-2 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Enregistrer</button></div>
      </form>
    </div>
  );
}
