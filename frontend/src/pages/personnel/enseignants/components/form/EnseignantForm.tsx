import { useEffect } from "react";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { EnseignantSchema } from "../../../../../generated/zod";
import EnseignantService from "../../../../../services/enseignant.service";
import {
  useEnseignantCreateStore,
  type EnseignantCreateInput,
} from "../../store/EnseignantCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";

function EnseignantForm() {
  const { etablissement_id } = useAuth();
  const service = new EnseignantService();
  const loading = useEnseignantCreateStore((state) => state.loading);
  const initialData = useEnseignantCreateStore((state) => state.initialData);
  const setInitialData = useEnseignantCreateStore(
    (state) => state.setInitialData,
  );
  const personnelOptions = useEnseignantCreateStore(
    (state) => state.personnelOptions,
  );
  const departementOptions = useEnseignantCreateStore(
    (state) => state.departementOptions,
  );
  const getPersonnelOptions = useEnseignantCreateStore(
    (state) => state.getPersonnelOptions,
  );
  const getDepartementOptions = useEnseignantCreateStore(
    (state) => state.getDepartementOptions,
  );

  useEffect(() => {
    getPersonnelOptions(etablissement_id ?? undefined);
    getDepartementOptions(etablissement_id ?? undefined);
    if (etablissement_id) {
      setInitialData({});
    }
  }, [
    etablissement_id,
    getDepartementOptions,
    getPersonnelOptions,
    setInitialData,
  ]);

  const enseignantFields = getFieldsFromZodObjectSchema(EnseignantSchema, {
    omit: ["id", "created_at", "updated_at"],
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      personnel_id: {
        relation: { options: personnelOptions },
      },
      departement_principal_id: {
        relation: { options: departementOptions },
      },
    },
    labelByField: {
      personnel_id: "Personnel",
      departement_principal_id: "Département principal",
    },
  });

  const enseignantSchema = EnseignantSchema.omit({
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
          schema={enseignantSchema}
          fields={enseignantFields}
          service={service}
          labelMessage={"Enseignant"}
          initialValues={initialData as Partial<EnseignantCreateInput>}
        />
      )}
    </div>
  );
}

export default EnseignantForm;
