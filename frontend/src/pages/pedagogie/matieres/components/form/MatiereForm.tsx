import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { MatiereSchema } from "../../../../../generated/zod";
import MatiereService from "../../../../../services/matiere.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useMatiereCreateStore } from "../../store/MatiereCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useEffect } from "react";

function MatiereForm() {
  const { etablissement_id } = useAuth();
  const service = new MatiereService();

  const getOptions = useMatiereCreateStore((state) => state.getOptions);

  const loading = useMatiereCreateStore((state) => state.loading);

  const departementOptions = useMatiereCreateStore(
    (state) => state.departementOptions,
  );

  useEffect(() => {
    if (etablissement_id) {
      getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const matiereFields = getFieldsFromZodObjectSchema(MatiereSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      departement_id: {
        relation: {
          options: departementOptions,
        },
      },
    },
    labelByField: {
      code: "Code",
      nom: "Nom",
      departement_id: "Département",
    },
  });

  const matiereSchema = MatiereSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  const initialValues = etablissement_id ? { etablissement_id } : undefined;

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <Form
          schema={matiereSchema}
          fields={matiereFields}
          service={service}
          labelMessage={"Matière"}
          initialValues={initialValues}
        />
      )}
    </div>
  );
}

export default MatiereForm;
