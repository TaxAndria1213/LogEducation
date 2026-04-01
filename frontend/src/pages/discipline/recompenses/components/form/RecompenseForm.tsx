import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import EleveService from "../../../../../services/eleve.service";
import RecompenseService from "../../../../../services/recompense.service";
import UtilisateurService from "../../../../../services/utilisateur.service";
import { buildReferentialOptions } from "../../../../../services/referenciel.service";
import { useReferentialCatalog } from "../../../../etablissement/referentiels/hooks/useReferentialCatalog";

const schema = z.object({ eleve_id: z.string().min(1), date: z.string().min(1), points: z.string().min(1), raison: z.string().optional(), donne_par: z.string().optional() });
type FormValues = z.infer<typeof schema>;

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "La recompense n'a pas pu etre enregistree.";
}

function getUtilisateurLabel(item: any) {
  const prenom = item?.profil?.prenom ?? "";
  const nom = item?.profil?.nom ?? "";
  const email = item?.email ?? "";
  return [prenom, nom].filter(Boolean).join(" ").trim() || email || "Utilisateur";
}

export default function RecompenseForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new RecompenseService(), []);
  const { rows: catalog } = useReferentialCatalog();
  const [eleves, setEleves] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!etablissement_id) return;
      const eleveService = new EleveService();
      const utilisateurService = new UtilisateurService();
      const [eleveResult, userResult] = await Promise.all([
        eleveService.getAll({ take: 500, where: JSON.stringify({ etablissement_id }), includeSpec: JSON.stringify({ utilisateur: { include: { profil: true } } }) }),
        utilisateurService.getAll({ take: 500, where: JSON.stringify({ etablissement_id }), includeSpec: JSON.stringify({ profil: true }) }),
      ]);
      setEleves(eleveResult?.status.success ? eleveResult.data.data : []);
      setUsers(userResult?.status.success ? userResult.data.data : []);
    };
    void load();
  }, [etablissement_id]);

  const reasonOptions = buildReferentialOptions(catalog, "DISCIPLINE_RECOMPENSE_RAISON", ["Bon comportement", "Esprit d'entraide", "Progression remarquable"]);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { eleve_id: "", date: new Date().toISOString().slice(0, 16), points: "1", raison: "", donne_par: "" } });

  const onSubmit = async (data: FormValues) => {
    try {
      await service.create({ eleve_id: data.eleve_id, date: new Date(data.date), points: Number(data.points), raison: data.raison || null, donne_par: data.donne_par || null });
      info("Recompense creee avec succes !", "success");
      form.reset({ eleve_id: "", date: new Date().toISOString().slice(0, 16), points: "1", raison: "", donne_par: "" });
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <Controller control={form.control} name="eleve_id" render={({ field, fieldState }) => <FieldWrapper id="eleve_id" label="Eleve" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Selectionner un eleve</option>{eleves.map((item) => <option key={item.id} value={item.id}>{item.code_eleve ? `${item.code_eleve} - ` : ""}{item.utilisateur?.profil?.prenom} {item.utilisateur?.profil?.nom}</option>)}</select></FieldWrapper>} />
        <Controller control={form.control} name="date" render={({ field, fieldState }) => <FieldWrapper id="date" label="Date et heure" required error={fieldState.error?.message}><input type="datetime-local" {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="points" render={({ field, fieldState }) => <FieldWrapper id="points" label="Points" required error={fieldState.error?.message}><input type="number" min={0} {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="donne_par" render={({ field, fieldState }) => <FieldWrapper id="donne_par" label="Attribue par" error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Aucun utilisateur</option>{users.map((item) => <option key={item.id} value={item.id}>{getUtilisateurLabel(item)}</option>)}</select></FieldWrapper>} />
        <Controller control={form.control} name="raison" render={({ field, fieldState }) => <div className="md:col-span-2"><FieldWrapper id="raison" label="Motif" error={fieldState.error?.message}><input {...field} list="discipline-reasons" className={getInputClassName(Boolean(fieldState.error))} /><datalist id="discipline-reasons">{reasonOptions.map((item) => <option key={item.value} value={item.value} />)}</datalist></FieldWrapper></div>} />
        <div className="md:col-span-2 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Enregistrer</button></div>
      </form>
    </div>
  );
}
