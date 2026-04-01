import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import RessourceBibliothequeService from "../../../../../services/ressourceBibliotheque.service";

const schema = z.object({
  type: z.enum(["livre", "materiel"]),
  titre: z.string().min(1, "Le titre est requis."),
  code: z.string().optional(),
  auteur: z.string().optional(),
  editeur: z.string().optional(),
  annee: z.string().optional(),
  stock: z.string().min(1, "Le stock est requis."),
});

type FormValues = z.infer<typeof schema>;

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "La ressource n'a pas pu etre enregistree.";
}

export default function RessourceBibliothequeForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new RessourceBibliothequeService(), []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "livre",
      titre: "",
      code: "",
      auteur: "",
      editeur: "",
      annee: "",
      stock: "1",
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await service.create({
        etablissement_id,
        type: data.type,
        titre: data.titre,
        code: data.code || null,
        auteur: data.auteur || null,
        editeur: data.editeur || null,
        annee: data.annee ? Number(data.annee) : null,
        stock: Number(data.stock || 1),
      });
      info("Ressource de bibliotheque creee avec succes !", "success");
      form.reset({
        type: "livre",
        titre: "",
        code: "",
        auteur: "",
        editeur: "",
        annee: "",
        stock: "1",
      });
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <Controller control={form.control} name="type" render={({ field, fieldState }) => <FieldWrapper id="type" label="Type" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="livre">Livre</option><option value="materiel">Materiel</option></select></FieldWrapper>} />
        <Controller control={form.control} name="titre" render={({ field, fieldState }) => <FieldWrapper id="titre" label="Titre" required error={fieldState.error?.message}><input {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="code" render={({ field, fieldState }) => <FieldWrapper id="code" label="Code" error={fieldState.error?.message}><input {...field} className={getInputClassName(Boolean(fieldState.error))} placeholder="Ex: LIV-0001" /></FieldWrapper>} />
        <Controller control={form.control} name="stock" render={({ field, fieldState }) => <FieldWrapper id="stock" label="Stock" required error={fieldState.error?.message}><input type="number" min={0} {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="auteur" render={({ field, fieldState }) => <FieldWrapper id="auteur" label="Auteur" error={fieldState.error?.message}><input {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="editeur" render={({ field, fieldState }) => <FieldWrapper id="editeur" label="Editeur" error={fieldState.error?.message}><input {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="annee" render={({ field, fieldState }) => <FieldWrapper id="annee" label="Annee" error={fieldState.error?.message}><input type="number" min={0} {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <div className="md:col-span-2 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Enregistrer</button></div>
      </form>
    </div>
  );
}
