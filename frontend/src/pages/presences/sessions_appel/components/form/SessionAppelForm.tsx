import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import ClasseService from "../../../../../services/classe.service";
import EmploiDuTempsService, {
  type EmploiDuTempsWithRelations,
} from "../../../../../services/emploiDuTemps.service";
import EnseignantService from "../../../../../services/enseignant.service";
import SessionAppelService from "../../../../../services/sessionAppel.service";

const schema = z.object({
  classe_id: z.string().min(1, "La classe est requise."),
  date: z.string().min(1, "La date est requise."),
  emploi_du_temps_id: z.string().min(1, "La seance est requise."),
  pris_par_enseignant_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }
  return "La session d'appel n'a pas pu etre enregistree.";
}

function parseDateValue(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getWeekdayNumber(value: string) {
  const date = parseDateValue(value);
  if (!date) return null;
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function isDateInsideWindow(
  dateValue: string,
  startValue?: Date | string | null,
  endValue?: Date | string | null,
) {
  const date = parseDateValue(dateValue);
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;

  if (!date || !start || !end) return false;

  date.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return date >= start && date <= end;
}

function getSeanceLabel(item: EmploiDuTempsWithRelations) {
  const matiere = item.cours?.matiere?.nom ?? item.matiere?.nom ?? "Cours";
  const horaire = [
    item.heure_debut ?? item.creneau?.heure_debut,
    item.heure_fin ?? item.creneau?.heure_fin,
  ]
    .filter(Boolean)
    .join(" - ");
  const salle = item.salle?.nom ? ` | ${item.salle.nom}` : "";

  return `${matiere} | ${horaire || "Horaire"}${salle}`;
}

export default function SessionAppelForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const classeService = useMemo(() => new ClasseService(), []);
  const emploiDuTempsService = useMemo(() => new EmploiDuTempsService(), []);
  const enseignantService = useMemo(() => new EnseignantService(), []);
  const sessionAppelService = useMemo(() => new SessionAppelService(), []);
  const [classes, setClasses] = useState<any[]>([]);
  const [enseignants, setEnseignants] = useState<any[]>([]);
  const [seances, setSeances] = useState<EmploiDuTempsWithRelations[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      classe_id: "",
      date: new Date().toISOString().slice(0, 10),
      emploi_du_temps_id: "",
      pris_par_enseignant_id: "",
    },
  });

  const selectedClasseId = form.watch("classe_id");
  const selectedDate = form.watch("date");

  useEffect(() => {
    const load = async () => {
      if (!etablissement_id) return;

      const [classeResult, enseignantResult, emploiResult] = await Promise.all([
        classeService.getAll({
          take: 500,
          where: JSON.stringify({ etablissement_id }),
          includeSpec: JSON.stringify({ niveau: true, site: true, annee: true }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        enseignantService.getAll({
          take: 500,
          where: JSON.stringify({ personnel: { etablissement_id } }),
          includeSpec: JSON.stringify({
            personnel: {
              include: {
                utilisateur: { include: { profil: true } },
              },
            },
            departement: true,
          }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        }),
        emploiDuTempsService.getForEtablissement(etablissement_id, {
          take: 5000,
          includeSpec: JSON.stringify({
            classe: { include: { niveau: true, site: true, annee: true } },
            cours: { include: { matiere: true } },
            matiere: true,
            salle: true,
            creneau: true,
          }),
        }),
      ]);

      setClasses(classeResult?.status.success ? classeResult.data.data : []);
      setEnseignants(enseignantResult?.status.success ? enseignantResult.data.data : []);
      setSeances(emploiResult?.status.success ? emploiResult.data.data : []);
    };

    void load();
  }, [classeService, emploiDuTempsService, enseignantService, etablissement_id]);

  const filteredSeances = useMemo(() => {
    const weekday = getWeekdayNumber(selectedDate);
    if (!selectedClasseId || !selectedDate || weekday == null) return [];

    return seances.filter((item) => {
      if (item.classe_id !== selectedClasseId) return false;
      if (item.jour_semaine !== weekday) return false;
      return isDateInsideWindow(selectedDate, item.effectif_du, item.effectif_au);
    });
  }, [selectedClasseId, selectedDate, seances]);

  useEffect(() => {
    const currentValue = form.getValues("emploi_du_temps_id");
    if (currentValue && filteredSeances.some((item) => item.id === currentValue)) {
      return;
    }

    form.setValue("emploi_du_temps_id", filteredSeances[0]?.id ?? "");
  }, [filteredSeances, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      await sessionAppelService.create({
        classe_id: data.classe_id,
        emploi_du_temps_id: data.emploi_du_temps_id,
        date: new Date(data.date),
        pris_par_enseignant_id: data.pris_par_enseignant_id || null,
      });

      info("Session d'appel creee avec succes !", "success");
      form.reset({
        ...form.getValues(),
        classe_id: "",
        emploi_du_temps_id: "",
        pris_par_enseignant_id: "",
      });
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 md:grid-cols-2">
      <Controller
        control={form.control}
        name="classe_id"
        render={({ field, fieldState }) => (
          <FieldWrapper id="classe_id" label="Classe" required error={fieldState.error?.message}>
            <select {...field} className={getInputClassName(Boolean(fieldState.error))}>
              <option value="">Selectionner une classe</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nom}
                </option>
              ))}
            </select>
          </FieldWrapper>
        )}
      />

      <Controller
        control={form.control}
        name="date"
        render={({ field, fieldState }) => (
          <FieldWrapper id="date" label="Date" required error={fieldState.error?.message}>
            <input type="date" {...field} className={getInputClassName(Boolean(fieldState.error))} />
          </FieldWrapper>
        )}
      />

      <Controller
        control={form.control}
        name="emploi_du_temps_id"
        render={({ field, fieldState }) => (
          <FieldWrapper
            id="emploi_du_temps_id"
            label="Seance EDT"
            required
            error={fieldState.error?.message}
            description="Seules les seances actives pour la classe et la date choisies sont proposees."
          >
            <select {...field} className={getInputClassName(Boolean(fieldState.error))}>
              <option value="">Selectionner une seance</option>
              {filteredSeances.map((item) => (
                <option key={item.id} value={item.id}>
                  {getSeanceLabel(item)}
                </option>
              ))}
            </select>
          </FieldWrapper>
        )}
      />

      <Controller
        control={form.control}
        name="pris_par_enseignant_id"
        render={({ field, fieldState }) => (
          <FieldWrapper id="pris_par_enseignant_id" label="Pris par" error={fieldState.error?.message}>
            <select {...field} className={getInputClassName(Boolean(fieldState.error))}>
              <option value="">Selectionner un enseignant</option>
              {enseignants.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.personnel?.code_personnel ?? item.id}
                </option>
              ))}
            </select>
          </FieldWrapper>
        )}
      />

      <div className="md:col-span-2 flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
        >
          Enregistrer
        </button>
      </div>
    </form>
  );
}
