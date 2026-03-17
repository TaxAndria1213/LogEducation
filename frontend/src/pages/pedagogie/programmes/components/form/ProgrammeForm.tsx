import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { ProgrammeSchema } from "../../../../../generated/zod";
import ProgrammeService from "../../../../../services/programme.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useEffect } from "react";
import { useProgrammeCreateStore } from "../../store/ProgrammeCreateStore";
import Spin from "../../../../../components/anim/Spin";

function ProgrammeForm() {
  const { etablissement_id } = useAuth();
  const service = new ProgrammeService();

  const loading = useProgrammeCreateStore((state) => state.loading);
  const initialData = useProgrammeCreateStore((state) => state.initialData);
  const anneeScolaireOptions = useProgrammeCreateStore(
    (state) => state.anneeScolaireOptions,
  )
  const niveauOptions = useProgrammeCreateStore((state) => state.niveauOptions);

  const getOptions = useProgrammeCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) {
      getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const programmeFields = getFieldsFromZodObjectSchema(ProgrammeSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      annee_scolaire_id: {
        relation: {
          options: anneeScolaireOptions,
        },
      }
      , niveau_scolaire_id: {
        relation: {
          options: niveauOptions,
        },
      }
    },
    labelByField: {
      nom: "Nom",
      annee_scolaire_id: "Année scolaire en cours",
      niveau_scolaire_id: "Niveau scolaire",
    },
  });

  const programmeSchema = ProgrammeSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des resources..." showLabel />
      ) : (
        <Form
          schema={programmeSchema}
          fields={programmeFields}
          service={service}
          labelMessage={"Programme"}
          initialValues={initialData || {}}
        />
      )}
    </div>
  );
}

export default ProgrammeForm;
