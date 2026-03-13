import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { ParentTuteurSchema } from "../../../../../generated/zod";
import ParentTuteurService from "../../../../../services/parentTuteur.service";
import { useParentTuteurCreateStore } from "../../store/ParentTuteurCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import type { ParentTuteur } from "../../../../../types/models";
import { useEffect } from "react";

function ParentTuteurForm() {
  const { etablissement_id } = useAuth();
  console.log("🚀 ~ ParentTuteurForm ~ etablissement_id:", etablissement_id);
  const service = new ParentTuteurService();
  const loading = useParentTuteurCreateStore((state) => state.loading);
  const etablissementOptions = useParentTuteurCreateStore(
    (state) => state.etablissementOptions,
  );

  const initialData = useParentTuteurCreateStore((state) => state.initialData);

  const setInitialData = useParentTuteurCreateStore((state) => state.setInitialData);

  const getEtablissementOptions = useParentTuteurCreateStore(
    (state) => state.getEtablissementOptions,
  );

  useEffect(() => {
    getEtablissementOptions();
    if (etablissement_id) {
      setInitialData({});
    }
  }, [getEtablissementOptions, etablissement_id, setInitialData]);

  useEffect(() => {
    console.log(etablissementOptions);
  }, [etablissementOptions]);

  const parentTuteurFields = getFieldsFromZodObjectSchema(ParentTuteurSchema, {
    omit: ["id", "created_at", "updated_at"],

    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
    },

    labelByField: {
      nom: "Nom",
    },
  });

  const parentTuteurSchema = ParentTuteurSchema.omit({
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
          schema={parentTuteurSchema}
          fields={parentTuteurFields}
          initialValues={initialData as Partial<ParentTuteur>}
          service={service}
          labelMessage={"Parent/Tuteur"}
        />
      )}
    </div>
  );
}

export default ParentTuteurForm;
