import { useEffect } from "react";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { SalleSchema } from "../../../../../generated/zod";
import { useSalleCreateStore, type SalleCreateInput } from "../../store/SalleCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import salleService from "../../../../../services/salle.service";

function SalleForm() {
  const {etablissement_id} = useAuth();
  const loading = useSalleCreateStore((state) => state.loading);
  const siteOptions = useSalleCreateStore(
    (state) => state.siteOptions,
  );

  const initialData = useSalleCreateStore((state) => state.initialData);

  // const setInitialData = useSalleCreateStore(
  //   (state) => state.setInitialData,
  // );


  const getSiteOptions = useSalleCreateStore(
    (state) => state.getSiteOptions,
  );

  useEffect(() => {
    getSiteOptions(etablissement_id as string);
  }, [getSiteOptions, etablissement_id]);

  const salleFields = getFieldsFromZodObjectSchema(SalleSchema, {
    omit: ["id", "created_at", "updated_at"],

    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      // relation example:
      site_id: {
        relation: {
          options: siteOptions,
        },
      },
    },

    labelByField: {
      site_id: "Site",
      nom: "Nom",
      capacite: "Capacité",
      type: "Type (ex: Labo)",
    },
  });

  const salleSchema = SalleSchema.omit({
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
          schema={salleSchema}
          fields={salleFields}
          service={salleService}
          labelMessage={"Salle"}
          initialValues={initialData as Partial<SalleCreateInput>}
        />
      )}
    </div>
  );
}

export default SalleForm;
