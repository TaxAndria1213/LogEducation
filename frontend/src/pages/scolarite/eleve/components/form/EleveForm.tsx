import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { EleveSchema } from "../../../../../generated/zod";
import EleveService from "../../../../../services/eleve.service";
import { useEleveCreateStore } from "../../store/EleveCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import type { Eleve } from "../../../../../types/models";
import { useEffect } from "react";

function EleveForm() {
  const { etablissement_id } = useAuth();
  console.log("🚀 ~ EleveForm ~ etablissement_id:", etablissement_id);
  const service = new EleveService();
  const loading = useEleveCreateStore((state) => state.loading);
  const etablissementOptions = useEleveCreateStore(
    (state) => state.etablissementOptions,
  );

  const initialData = useEleveCreateStore((state) => state.initialData);

  const setInitialData = useEleveCreateStore((state) => state.setInitialData);

  const getEtablissementOptions = useEleveCreateStore(
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

  const eleveFields = getFieldsFromZodObjectSchema(EleveSchema, {
    omit: ["id", "created_at", "updated_at"],

    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
    },

    labelByField: {
      nom: "Nom",
    },
  });

  const eleveSchema = EleveSchema.omit({
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
          schema={eleveSchema}
          fields={eleveFields}
          initialValues={initialData as Partial<Eleve>}
          service={service}
          labelMessage={"Elèves"}
        />
      )}
    </div>
  );
}

export default EleveForm;
