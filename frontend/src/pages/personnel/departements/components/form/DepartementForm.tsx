import { useEffect } from "react";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { DepartementSchema } from "../../../../../generated/zod";
import DepartementService from "../../../../../services/departement.service";
import {
  useDepartementCreateStore,
  type DepartementCreateInput,
} from "../../store/DepartementCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";

function DepartementForm() {
  const { etablissement_id } = useAuth();
  const service = new DepartementService();
  const loading = useDepartementCreateStore((state) => state.loading);
  const initialData = useDepartementCreateStore((state) => state.initialData);
  const setInitialData = useDepartementCreateStore(
    (state) => state.setInitialData,
  );

  useEffect(() => {
    if (etablissement_id) {
      console.log("🚀 ~ DepartementForm ~ etablissement_id:", etablissement_id)
      setInitialData({ etablissement_id });
    }
  }, [etablissement_id, setInitialData]);

  const departementFields = getFieldsFromZodObjectSchema(DepartementSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
    },
    labelByField: {
      nom: "Nom du département",
    },
  });

  const departementSchema = DepartementSchema.omit({
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
          schema={departementSchema}
          fields={departementFields}
          service={service}
          labelMessage={"Département"}
          initialValues={initialData as Partial<DepartementCreateInput>}
        />
      )}
    </div>
  );
}

export default DepartementForm;
