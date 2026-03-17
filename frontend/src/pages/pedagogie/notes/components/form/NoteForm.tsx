import { useEffect } from "react";
import { useAuth } from "../../../../../auth/AuthContext";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { NoteSchema } from "../../../../../generated/zod";
import NoteService from "../../../../../services/note.service";
import { useNoteCreateStore } from "../../store/NoteCreateStore";
import type { Note } from "../../../../../types/models";
import Spin from "../../../../../components/anim/Spin";

function NoteForm() {
  const service = new NoteService();
  const { etablissement_id } = useAuth();

  const evaluationOptions = useNoteCreateStore(
    (state) => state.evaluationOptions,
  );
  const loading = useNoteCreateStore((state) => state.loading);
  const eleveOptions = useNoteCreateStore((state) => state.eleveOptions);
  const initialData = useNoteCreateStore((state) => state.initialData);
  const getOptions = useNoteCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) {
      getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const noteFields = getFieldsFromZodObjectSchema(NoteSchema, {
    omit: ["id", "created_at", "updated_at"],
    metaByField: {
      note_le: { dateMode: "datetime" },
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      evaluation_id: {
        relation: {
          options: evaluationOptions,
        },
      },
      eleve_id: {
        relation: {
          options: eleveOptions,
        },
      },
    },
    labelByField: {
      evaluation_id: "Evaluation",
      eleve_id: "élève",
      score: "Note",
      commentaire: "Commentaire",
      note_le: "Noté le",
      note_par: "Noté par",
    },
  });

  const noteSchema = NoteSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  return (
    <div className="w-[100%]">
      {loading ? <Spin label="Chargement..." showLabel /> : <Form
        schema={noteSchema}
        fields={noteFields}
        service={service}
        initialValues={initialData as Partial<Note>}
        labelMessage={"Note"}
      />}
    </div>
  );
}

export default NoteForm;
