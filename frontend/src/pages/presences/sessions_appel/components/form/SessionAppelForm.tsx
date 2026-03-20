import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import ClasseService from "../../../../../services/classe.service";
import CreneauHoraireService from "../../../../../services/creneauHoraire.service";
import EnseignantService from "../../../../../services/enseignant.service";
import SessionAppelService from "../../../../../services/sessionAppel.service";

const schema = z.object({
  classe_id: z.string().min(1, "La classe est requise."),
  date: z.string().min(1, "La date est requise."),
  creneau_horaire_id: z.string().min(1, "Le creneau est requis."),
  pris_par_enseignant_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" && error !== null &&
    "response" in error && typeof error.response === "object" && error.response !== null &&
    "data" in error.response && typeof error.response.data === "object" && error.response.data !== null &&
    "message" in error.response.data && typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }
  return "La session d'appel n'a pas pu etre enregistree.";
}

export default function SessionAppelForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new SessionAppelService(), []);
  const [classes, setClasses] = useState<any[]>([]);
  const [creneaux, setCreneaux] = useState<any[]>([]);
  const [enseignants, setEnseignants] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!etablissement_id) return;
      const classeService = new ClasseService();
      const creneauService = new CreneauHoraireService();
      const enseignantService = new EnseignantService();
      const [classeResult, creneauResult, enseignantResult] = await Promise.all([
        classeService.getAll({ take: 500, where: JSON.stringify({ etablissement_id }), includeSpec: JSON.stringify({ niveau: true, site: true }), orderBy: JSON.stringify([{ nom: "asc" }]) }),
        creneauService.getAll({ take: 500, where: JSON.stringify({ etablissement_id }), orderBy: JSON.stringify([{ ordre: "asc" }, { heure_debut: "asc" }]) }),
        enseignantService.getAll({ take: 500, where: JSON.stringify({ personnel: { etablissement_id } }), includeSpec: JSON.stringify({ personnel: { include: { utilisateur: { include: { profil: true } } } }, departement: true }), orderBy: JSON.stringify([{ created_at: "desc" }]) }),
      ]);
      setClasses(classeResult?.status.success ? classeResult.data.data : []);
      setCreneaux(creneauResult?.status.success ? creneauResult.data.data : []);
      setEnseignants(enseignantResult?.status.success ? enseignantResult.data.data : []);
    };
    void load();
  }, [etablissement_id]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      classe_id: "",
      date: new Date().toISOString().slice(0, 10),
      creneau_horaire_id: "",
      pris_par_enseignant_id: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await service.create({
        classe_id: data.classe_id,
        date: new Date(data.date),
        creneau_horaire_id: data.creneau_horaire_id,
        pris_par_enseignant_id: data.pris_par_enseignant_id || null,
      });
      info("Session d'appel creee avec succes !", "success");
      form.reset({ ...form.getValues(), classe_id: "", creneau_horaire_id: "", pris_par_enseignant_id: "" });
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 md:grid-cols-2">
      <Controller control={form.control} name="classe_id" render={({ field, fieldState }) => (
        <FieldWrapper id="classe_id" label="Classe" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Selectionner une classe</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</select></FieldWrapper>
      )} />
      <Controller control={form.control} name="date" render={({ field, fieldState }) => (
        <FieldWrapper id="date" label="Date" required error={fieldState.error?.message}><input type="date" {...field} className={getInputClassName(Boolean(fieldState.error))} /></FieldWrapper>
      )} />
      <Controller control={form.control} name="creneau_horaire_id" render={({ field, fieldState }) => (
        <FieldWrapper id="creneau_horaire_id" label="Creneau" required error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Selectionner un creneau</option>{creneaux.map((item) => <option key={item.id} value={item.id}>{item.nom} ({item.heure_debut} - {item.heure_fin})</option>)}</select></FieldWrapper>
      )} />
      <Controller control={form.control} name="pris_par_enseignant_id" render={({ field, fieldState }) => (
        <FieldWrapper id="pris_par_enseignant_id" label="Pris par" error={fieldState.error?.message}><select {...field} className={getInputClassName(Boolean(fieldState.error))}><option value="">Selectionner un enseignant</option>{enseignants.map((item) => <option key={item.id} value={item.id}>{item.personnel?.code_personnel ?? item.id}</option>)}</select></FieldWrapper>
      )} />
      <div className="md:col-span-2 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Enregistrer</button></div>
    </form>
  );
}
