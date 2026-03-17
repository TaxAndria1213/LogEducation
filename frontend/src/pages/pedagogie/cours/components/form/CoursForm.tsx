import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { CoursSchema } from "../../../../../generated/zod";
import CoursService from "../../../../../services/cours.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useEffect } from "react";
import { useCoursCreateStore } from "../../store/CoursCreateStore";
import Spin from "../../../../../components/anim/Spin";

function CoursForm() {
  const { etablissement_id } = useAuth();
  const service = new CoursService();
  const loading = useCoursCreateStore((state) => state.loading);
  const initialData = useCoursCreateStore((state) => state.initialData);
  const anneeScolaireOtpions = useCoursCreateStore(
    (state) => state.anneeScolaireOtpions,
  );
  const classeOptions = useCoursCreateStore((state) => state.classeOptions);
  const matiereOptions = useCoursCreateStore((state) => state.matiereOptions);
  const enseignantOptions = useCoursCreateStore(
    (state) => state.enseignantOptions,
  )

  const getOptions = useCoursCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) getOptions(etablissement_id);
  }, [etablissement_id, getOptions]);

  const coursFields = getFieldsFromZodObjectSchema(CoursSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      annee_scolaire_id: {
        relation: {
          options: anneeScolaireOtpions,
        },
      },
      classe_id: {
        relation: {
          options: classeOptions,
        },
      },
      matiere_id: {
        relation: {
          options: matiereOptions,
        },
      },
      enseignant_id: {
        relation: {
          options: enseignantOptions,
        },
      },
    },
    labelByField: {
      annee_scolaire_id: "Année scolaire en cours",
      classe_id: "Classe",
      matiere_id: "Matière",
      enseignant_id: "Enseignant",
      coefficient_override: "Coefficient (optionnel)",
    },
  });

  const coursSchema = CoursSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement..." showLabel />
      ) : (
        <Form
          schema={coursSchema}
          fields={coursFields}
          service={service}
          labelMessage={"Cours"}
          initialValues={initialData || {}}
        />
      )}
    </div>
  );
}

export default CoursForm;
