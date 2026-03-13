import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { NiveauScolaireSchema } from "../../../../../generated/zod";
import NiveauService from "../../../../../services/niveau.service";
import { useNiveauCreateStore } from "../../store/NiveauCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import type { NiveauScolaire } from "../../../../../types/models";
import { useEffect } from "react";

function NiveauForm() {
  const { etablissement_id } = useAuth();
  console.log("🚀 ~ NiveauForm ~ etablissement_id:", etablissement_id);
  const service = new NiveauService();
  const loading = useNiveauCreateStore((state) => state.loading);
  const etablissementOptions = useNiveauCreateStore(
    (state) => state.etablissementOptions,
  );

  const initialData = useNiveauCreateStore((state) => state.initialData);

  const setInitialData = useNiveauCreateStore((state) => state.setInitialData);

  const getEtablissementOptions = useNiveauCreateStore(
    (state) => state.getEtablissementOptions,
  );

  useEffect(() => {
    getEtablissementOptions();
    if (etablissement_id) {
      setInitialData({etablissement_id: etablissement_id});
    }
  }, [getEtablissementOptions, etablissement_id, setInitialData]);

  useEffect(() => {
    console.log(etablissementOptions);
  }, [etablissementOptions]);

  const niveauFields = getFieldsFromZodObjectSchema(NiveauScolaireSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],

    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
    },

    labelByField: {
      nom: "Nom",
    },
  });

  const niveauSchema = NiveauScolaireSchema.omit({
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
          schema={niveauSchema}
          fields={niveauFields}
          initialValues={initialData as Partial<NiveauScolaire>}
          service={service}
          labelMessage={"Niveau"}
        />
      )}
    </div>
  );
}

export default NiveauForm;
