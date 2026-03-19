import { useEffect, useMemo } from "react";
import { useAuth } from "../../../../auth/AuthContext";
import Spin from "../../../../components/anim/Spin";
import { Form } from "../../../../components/Form/Form";
import { SelectField } from "../../../../components/Form/fields/index";
import {
  getFieldsFromZodObjectSchema,
  type DynamicField,
} from "../../../../components/Form/fields";
import { EmploiDuTempsSchema } from "../../../../generated/zod";
import EmploiDuTempsService from "../../../../services/emploiDuTemps.service";
import { useEmploiDuTempsCreateStore } from "../../store/EmploiDuTempsCreateStore";
import { isPauseCourseValue, WEEKDAY_OPTIONS } from "../../types";

function ScheduleForm() {
  const { etablissement_id } = useAuth();
  const service = new EmploiDuTempsService();

  const loading = useEmploiDuTempsCreateStore((state) => state.loading);
  const classeOptions = useEmploiDuTempsCreateStore((state) => state.classeOptions);
  const coursOptions = useEmploiDuTempsCreateStore((state) => state.coursOptions);
  const salleOptions = useEmploiDuTempsCreateStore((state) => state.salleOptions);
  const creneauOptions = useEmploiDuTempsCreateStore((state) => state.creneauOptions);
  const getOptions = useEmploiDuTempsCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) getOptions(etablissement_id);
  }, [etablissement_id, getOptions]);

  const scheduleFields = useMemo<DynamicField[]>(
    () =>
      getFieldsFromZodObjectSchema(EmploiDuTempsSchema, {
        omit: ["id", "created_at", "updated_at", "matiere_id", "enseignant_id"],
        metaByField: {
          classe_id: { relation: { options: classeOptions } },
          cours_id: { relation: { options: coursOptions } },
          salle_id: { relation: { options: salleOptions } },
          creneau_horaire_id: { relation: { options: creneauOptions } },
          effectif_du: { dateMode: "datetime" },
          effectif_au: { dateMode: "datetime" },
          created_at: { dateMode: "datetime" },
          updated_at: { dateMode: "datetime" },
        },
        labelByField: {
          classe_id: "Classe",
          cours_id: "Cours ou pause",
          salle_id: "Salle",
          jour_semaine: "Jour de la semaine",
          creneau_horaire_id: "Creneau horaire",
          effectif_du: "Actif du",
          effectif_au: "Actif au",
        },
      }).map((field) =>
        field.name === "jour_semaine"
          ? {
              ...field,
              Component: SelectField,
              props: {
                options: WEEKDAY_OPTIONS,
                emptyLabel: "Choisir un jour",
              },
            }
          : field,
      ),
    [classeOptions, coursOptions, creneauOptions, salleOptions],
  );

  const scheduleSchema = EmploiDuTempsSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    matiere_id: true,
    enseignant_id: true,
  });

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_48%,_#ecfeff_100%)] px-6 py-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Nouvelle ligne d'emploi du temps
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Utilise ce formulaire pour une ligne ciblee. Le cours renseigne automatiquement
          la matiere et l'enseignant; pour construire toute la grille d'une classe, passe
          plutot par le dashboard.
        </p>
      </section>

      <section className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        {loading ? (
          <Spin label="Chargement des ressources..." showLabel />
        ) : (
          <Form
            schema={scheduleSchema}
            fields={scheduleFields}
            service={{
              create: async (data: Record<string, unknown>) => {
                if (!data.cours_id) {
                  throw new Error("Choisis un cours ou l'option Pause avant d'enregistrer la ligne.");
                }

                if (isPauseCourseValue(data.cours_id as string | undefined)) {
                  return service.create({
                    ...data,
                    cours_id: null,
                    salle_id: null,
                  });
                }

                return service.create(data);
              },
            }}
            labelMessage={"Emploi du temps"}
          />
        )}
      </section>
    </div>
  );
}

export default ScheduleForm;
