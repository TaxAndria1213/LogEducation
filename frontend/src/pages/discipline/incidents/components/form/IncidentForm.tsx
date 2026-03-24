import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import EleveService from "../../../../../services/eleve.service";
import IncidentDisciplinaireService from "../../../../../services/incidentDisciplinaire.service";
import UtilisateurService from "../../../../../services/utilisateur.service";
import ReferencielService, { buildReferentialOptions } from "../../../../../services/referenciel.service";
import { useReferentialCatalog } from "../../../../etablissement/referentiels/hooks/useReferentialCatalog";

const schema = z.object({
  eleve_id: z.string().min(1),
  date: z.string().min(1),
  gravite: z.string().optional(),
  statut: z.string().min(1),
  signale_par: z.string().optional(),
  description: z.string().min(5),
});

type FormValues = z.infer<typeof schema>;

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") {
    return error.response.data.message;
  }
  return "L'incident n'a pas pu etre enregistre.";
}

function getUtilisateurLabel(item: any) {
  const prenom = item?.profil?.prenom ?? "";
  const nom = item?.profil?.nom ?? "";
  const email = item?.email ?? "";
  return [prenom, nom].filter(Boolean).join(" ").trim() || email || "Utilisateur";
}

export default function IncidentForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new IncidentDisciplinaireService(), []);
  const { rows: catalog } = useReferentialCatalog();
  const [eleves, setEleves] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!etablissement_id) return;
      const eleveService = new EleveService();
      const utilisateurService = new UtilisateurService();
      const [eleveResult, userResult] = await Promise.all([
        eleveService.getAll({
          take: 500,
          where: JSON.stringify({ etablissement_id }),
          includeSpec: JSON.stringify({ utilisateur: { include: { profil: true } } }),
        }),
        utilisateurService.getAll({
          take: 500,
          where: JSON.stringify({ etablissement_id }),
          includeSpec: JSON.stringify({ profil: true }),
        }),
      ]);
      setEleves(eleveResult?.status.success ? eleveResult.data.data : []);
      setUsers(userResult?.status.success ? userResult.data.data : []);
    };
    void load();
  }, [etablissement_id]);

  const statusOptions = buildReferentialOptions(catalog, "DISCIPLINE_INCIDENT_STATUT", [
    "OUVERT",
    "EN_COURS",
    "RESOLU",
    "CLOS",
  ]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      eleve_id: "",
      date: new Date().toISOString().slice(0, 16),
      gravite: "",
      statut: statusOptions[0]?.value ?? "OUVERT",
      signale_par: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!form.getValues("statut") && statusOptions[0]?.value) {
      form.setValue("statut", statusOptions[0].value);
    }
  }, [form, statusOptions]);

  const onSubmit = async (data: FormValues) => {
    try {
      await service.create({
        eleve_id: data.eleve_id,
        date: new Date(data.date),
        gravite: data.gravite ? Number(data.gravite) : null,
        statut: data.statut,
        signale_par: data.signale_par || null,
        description: data.description,
      });
      info("Incident disciplinaire cree avec succes !", "success");
      form.reset({
        eleve_id: "",
        date: new Date().toISOString().slice(0, 16),
        gravite: "",
        statut: statusOptions[0]?.value ?? "OUVERT",
        signale_par: "",
        description: "",
      });
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Nouveau signalement disciplinaire</h2>
        <p className="mt-2 text-sm text-slate-500">Documente un incident avec l'eleve concerne, le niveau de gravite et le statut de traitement.</p>
      </section>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <Controller control={form.control} name="eleve_id" render={({ field, fieldState }) => <FieldWrapper id="eleve_id" label="Eleve" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Selectionner un eleve</option>{eleves.map((item) => <option key={item.id} value={item.id}>{item.code_eleve ? `${item.code_eleve} - ` : ""}{item.utilisateur?.profil?.prenom} {item.utilisateur?.profil?.nom}</option>)}</select></FieldWrapper>} />
        <Controller control={form.control} name="date" render={({ field, fieldState }) => <FieldWrapper id="date" label="Date et heure" required error={fieldState.error?.message}><input type="datetime-local" {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="gravite" render={({ field, fieldState }) => <FieldWrapper id="gravite" label="Gravite" error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Non renseignee</option>{[1,2,3,4,5].map((level) => <option key={level} value={String(level)}>{level}/5</option>)}</select></FieldWrapper>} />
        <Controller control={form.control} name="statut" render={({ field, fieldState }) => <FieldWrapper id="statut" label="Statut" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldWrapper>} />
        <Controller control={form.control} name="signale_par" render={({ field, fieldState }) => <FieldWrapper id="signale_par" label="Declare par" error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Aucun declarant</option>{users.map((item) => <option key={item.id} value={item.id}>{getUtilisateurLabel(item)}</option>)}</select></FieldWrapper>} />
        <div className="hidden md:block" />
        <Controller control={form.control} name="description" render={({ field, fieldState }) => <div className="md:col-span-2"><FieldWrapper id="description" label="Description factuelle" required error={fieldState.error?.message}><textarea {...field} rows={5} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper></div>} />
        <div className="md:col-span-2 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Enregistrer</button></div>
      </form>
    </div>
  );
}
