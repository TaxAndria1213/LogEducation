import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { RegleNoteSchema } from "../../../../../generated/zod";
import RegleNoteService from "../../../../../services/regleNote.service";
import { useAuth } from "../../../../../auth/AuthContext";

function RegleNoteForm() {
  const { etablissement_id } = useAuth();
  const service = new RegleNoteService();

  const regleNoteFields = getFieldsFromZodObjectSchema(RegleNoteSchema, {
    omit: ["id", "created_at", "updated_at"],
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
    },
    labelByField: {
      scope: "Portée",
      regle_json: "Règle (JSON)",
    },
  });

  const regleNoteSchema = RegleNoteSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  const initialValues = etablissement_id ? { etablissement_id } : undefined;

  return (
    <div className="w-[100%]">
      <Form
        schema={regleNoteSchema}
        fields={regleNoteFields}
        service={service}
        labelMessage={"Règle de note"}
        initialValues={initialValues}
      />
    </div>
  );
}

export default RegleNoteForm;
