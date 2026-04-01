import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import IncidentDisciplinaireService, { getIncidentDisplayLabel } from "../../../../../services/incidentDisciplinaire.service";
import SanctionDisciplinaireService from "../../../../../services/sanctionDisciplinaire.service";
import UtilisateurService from "../../../../../services/utilisateur.service";
import { buildReferentialOptions } from "../../../../../services/referenciel.service";
import { useReferentialCatalog } from "../../../../etablissement/referentiels/hooks/useReferentialCatalog";

const schema = z.object({ incident_id: z.string().min(1), type_action: z.string().min(1), debut: z.string().optional(), fin: z.string().optional(), decide_par: z.string().optional(), notes: z.string().optional() });
type FormValues = z.infer<typeof schema>;

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "La sanction n'a pas pu etre enregistree.";
}

function getUtilisateurLabel(item: any) {
  const prenom = item?.profil?.prenom ?? "";
  const nom = item?.profil?.nom ?? "";
  const email = item?.email ?? "";
  return [prenom, nom].filter(Boolean).join(" ").trim() || email || "Utilisateur";
}

export default function SanctionForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new SanctionDisciplinaireService(), []);
  const incidentService = useMemo(() => new IncidentDisciplinaireService(), []);
  const { rows: catalog } = useReferentialCatalog();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!etablissement_id) return;
      const utilisateurService = new UtilisateurService();
      const [incidentResult, userResult] = await Promise.all([
        incidentService.getForEtablissement(etablissement_id, { take: 500, includeSpec: JSON.stringify({ eleve: { include: { utilisateur: { include: { profil: true } } } } }) }),
        utilisateurService.getAll({ take: 500, where: JSON.stringify({ etablissement_id }), includeSpec: JSON.stringify({ profil: true }) }),
      ]);
      setIncidents(incidentResult?.status.success ? incidentResult.data.data : []);
      setUsers(userResult?.status.success ? userResult.data.data : []);
    };
    void load();
  }, [etablissement_id, incidentService]);

  const typeOptions = buildReferentialOptions(catalog, "DISCIPLINE_SANCTION_TYPE", ["Avertissement", "Retenue", "Convocation", "Exclusion temporaire"]);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { incident_id: "", type_action: typeOptions[0]?.value ?? "", debut: "", fin: "", decide_par: "", notes: "" } });

  useEffect(() => {
    if (!form.getValues("type_action") && typeOptions[0]?.value) form.setValue("type_action", typeOptions[0].value);
  }, [form, typeOptions]);

  const onSubmit = async (data: FormValues) => {
    try {
      await service.create({ incident_id: data.incident_id, type_action: data.type_action, debut: data.debut ? new Date(data.debut) : null, fin: data.fin ? new Date(data.fin) : null, decide_par: data.decide_par || null, notes: data.notes || null });
      info("Sanction disciplinaire creee avec succes !", "success");
      form.reset({ incident_id: "", type_action: typeOptions[0]?.value ?? "", debut: "", fin: "", decide_par: "", notes: "" });
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <Controller control={form.control} name="incident_id" render={({ field, fieldState }) => <FieldWrapper id="incident_id" label="Incident" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Selectionner un incident</option>{incidents.map((item) => <option key={item.id} value={item.id}>{getIncidentDisplayLabel(item)}</option>)}</select></FieldWrapper>} />
        <Controller control={form.control} name="type_action" render={({ field, fieldState }) => <FieldWrapper id="type_action" label="Type de sanction" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}>{typeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FieldWrapper>} />
        <Controller control={form.control} name="debut" render={({ field, fieldState }) => <FieldWrapper id="debut" label="Debut" error={fieldState.error?.message}><input type="date" {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="fin" render={({ field, fieldState }) => <FieldWrapper id="fin" label="Fin" error={fieldState.error?.message}><input type="date" {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>} />
        <Controller control={form.control} name="decide_par" render={({ field, fieldState }) => <FieldWrapper id="decide_par" label="Decide par" error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Aucun decideur</option>{users.map((item) => <option key={item.id} value={item.id}>{getUtilisateurLabel(item)}</option>)}</select></FieldWrapper>} />
        <div className="hidden md:block" />
        <Controller control={form.control} name="notes" render={({ field, fieldState }) => <div className="md:col-span-2"><FieldWrapper id="notes" label="Notes de suivi" error={fieldState.error?.message}><textarea {...field} rows={4} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper></div>} />
        <div className="md:col-span-2 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Enregistrer</button></div>
      </form>
    </div>
  );
}
