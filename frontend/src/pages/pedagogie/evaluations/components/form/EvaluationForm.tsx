import { useEffect } from "react";
import { useAuth } from "../../../../../auth/AuthContext";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { EvaluationSchema } from "../../../../../generated/zod";
import EvaluationService from "../../../../../services/evaluation.service";
import { useEvaluationCreateStore } from "../../store/EvaluationCreateStore";

function EvaluationForm() {
  const { etablissement_id } = useAuth();
  const service = new EvaluationService();

  const coursOptions = useEvaluationCreateStore(
    (state) => state.coursOptions,
  )
  const periodeOptions = useEvaluationCreateStore(
    (state) => state.periodeOptions,
  )

  const getOptions = useEvaluationCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) getOptions(etablissement_id);
  }, [etablissement_id, getOptions]);

  const evaluationFields = getFieldsFromZodObjectSchema(EvaluationSchema, {
    omit: ["id", "created_at", "updated_at"],
    metaByField: {
      date: { dateMode: "datetime" },
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      type: {
        relation: {
          options: [
            { value: "AUTRE", label: "AUTRE" },
            { value: "DEVOIR", label: "DEVOIR" },
            { value: "EXAMEN", label: "EXAMEN" },
            { value: "ORAL", label: "ORAL" },
          ],
        },
      },
      cours_id: {
        relation: {
          options: coursOptions,
        },
      },
      periode_id: {
        relation: {
          options: periodeOptions,
        },
      },
    },
    labelByField: {
      cours_id: "Cours",
      periode_id: "Période",
      type_evaluation_id: "Type d'évaluation",
      type: "Type",
      titre: "Titre",
      date: "Date",
      note_max: "Note max",
      poids: "Poids",
    },
  });

  const evaluationSchema = EvaluationSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  return (
    <div className="w-[100%]">
      <Form
        schema={evaluationSchema}
        fields={evaluationFields}
        service={service}
        labelMessage={"évaluation"}
      />
    </div>
  );
}

export default EvaluationForm;
