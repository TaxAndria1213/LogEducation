import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { IdentifiantEleveSchema } from "../../../../../generated/zod";
import IdentifiantEleveService from "../../../../../services/identifiantEleve.service";
import { useIdentifiantEleveCreateStore } from "../../store/IdEleveCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import type { IdentifiantEleve } from "../../../../../types/models";
import { useEffect } from "react";

function IdentifiantEleveForm() {
  const { etablissement_id } = useAuth();
  console.log("🚀 ~ IdentifiantEleveForm ~ etablissement_id:", etablissement_id);
  const service = new IdentifiantEleveService();
  const loading = useIdentifiantEleveCreateStore((state) => state.loading);
  const etablissementOptions = useIdentifiantEleveCreateStore(
    (state) => state.etablissementOptions,
  );

  const initialData = useIdentifiantEleveCreateStore((state) => state.initialData);

  const setInitialData = useIdentifiantEleveCreateStore((state) => state.setInitialData);

  const getEtablissementOptions = useIdentifiantEleveCreateStore(
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

  const identifiantEleveFields = getFieldsFromZodObjectSchema(IdentifiantEleveSchema, {
    omit: ["id", "created_at", "updated_at"],

    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
    },

    labelByField: {
      nom: "Nom",
    },
  });

  const identifiantEleveSchema = IdentifiantEleveSchema.omit({
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
          schema={identifiantEleveSchema}
          fields={identifiantEleveFields}
          initialValues={initialData as Partial<IdentifiantEleve>}
          service={service}
          labelMessage={"Identifiant"}
        />
      )}
    </div>
  );
}

export default IdentifiantEleveForm;
