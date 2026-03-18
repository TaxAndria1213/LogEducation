import { useEffect } from "react";
import { useAuth } from "../../../../auth/AuthContext";
import Spin from "../../../../components/anim/Spin";
import { Form } from "../../../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../../../components/Form/fields";
import { EmploiDuTempsSchema } from "../../../../generated/zod";
import EmploiDuTempsService from "../../../../services/emploiDuTemps.service";
import { useEmploiDuTempsCreateStore } from "../../store/EmploiDuTempsCreateStore";

function ScheduleForm() {
  const { etablissement_id } = useAuth();
  const service = new EmploiDuTempsService();

  const loading = useEmploiDuTempsCreateStore((state) => state.loading);
  const classeOptions = useEmploiDuTempsCreateStore((state) => state.classeOptions);
  const coursOptions = useEmploiDuTempsCreateStore((state) => state.coursOptions);
  const matiereOptions = useEmploiDuTempsCreateStore((state) => state.matiereOptions);
  const enseignantOptions = useEmploiDuTempsCreateStore((state) => state.enseignantOptions);
  const salleOptions = useEmploiDuTempsCreateStore((state) => state.salleOptions);
  const creneauOptions = useEmploiDuTempsCreateStore((state) => state.creneauOptions);
  const getOptions = useEmploiDuTempsCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) getOptions(etablissement_id);
  }, [etablissement_id, getOptions]);

  const scheduleFields = getFieldsFromZodObjectSchema(EmploiDuTempsSchema, {
    omit: ["id", "created_at", "updated_at"],
    metaByField: {
      classe_id: { relation: { options: classeOptions } },
      cours_id: { relation: { options: coursOptions } },
      matiere_id: { relation: { options: matiereOptions } },
      enseignant_id: { relation: { options: enseignantOptions } },
      salle_id: { relation: { options: salleOptions } },
      creneau_horaire_id: { relation: { options: creneauOptions } },
      effectif_du: { dateMode: "datetime" },
      effectif_au: { dateMode: "datetime" },
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
    },
    labelByField: {
      classe_id: "Classe",
      cours_id: "Cours",
      matiere_id: "Matiere",
      enseignant_id: "Enseignant",
      salle_id: "Salle",
      jour_semaine: "Jour de la semaine (1 a 7)",
      creneau_horaire_id: "Creneau horaire",
      effectif_du: "Actif du",
      effectif_au: "Actif au",
    },
  });

  const scheduleSchema = EmploiDuTempsSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <Form
          schema={scheduleSchema}
          fields={scheduleFields}
          service={service}
          labelMessage={"Emploi du temps"}
        />
      )}
    </div>
  );
}

export default ScheduleForm;
