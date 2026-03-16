import { useEffect } from "react";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { PersonnelSchema } from "../../../../../generated/zod";
import PersonnelService from "../../../../../services/personnel.service";
import {
  usePersonnelCreateStore,
  type PersonnelCreateInput,
} from "../../store/PersonnelCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";

function PersonnelForm() {
  const { etablissement_id } = useAuth();
  const service = new PersonnelService();
  const loading = usePersonnelCreateStore((state) => state.loading);
  const initialData = usePersonnelCreateStore((state) => state.initialData);
  const setInitialData = usePersonnelCreateStore(
    (state) => state.setInitialData,
  );

  useEffect(() => {
    if (etablissement_id) {
      setInitialData({ etablissement_id });
    }
  }, [etablissement_id, setInitialData]);

  const personnelFields = getFieldsFromZodObjectSchema(PersonnelSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      date_embauche: { dateMode: "date" },
    },
    labelByField: {
      code_personnel: "Code personnel",
      utilisateur_id: "Utilisateur",
      date_embauche: "Date d'embauche",
      statut: "Statut",
      poste: "Poste",
    },
  });

  const personnelSchema = PersonnelSchema.omit({
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
          schema={personnelSchema}
          fields={personnelFields}
          service={service}
          labelMessage={"Personnel"}
          initialValues={initialData as Partial<PersonnelCreateInput>}
        />
      )}
    </div>
  );
}

export default PersonnelForm;
