import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { RoleSchema } from "../../../../../generated/zod";
import RoleService from "../../../../../services/role.service";
import { useRoleCreateStore } from "../../store/RoleCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import type { Role } from "../../../../../types/models";
import { useEffect } from "react";

function RoleForm() {
  const { etablissement_id } = useAuth();
  console.log("🚀 ~ RoleForm ~ etablissement_id:", etablissement_id);
  const service = new RoleService();
  const loading = useRoleCreateStore((state) => state.loading);
  const etablissementOptions = useRoleCreateStore(
    (state) => state.etablissementOptions,
  );

  const initialData = useRoleCreateStore((state) => state.initialData);

  const setInitialData = useRoleCreateStore((state) => state.setInitialData);

  const getEtablissementOptions = useRoleCreateStore(
    (state) => state.getEtablissementOptions,
  );

  useEffect(() => {
    getEtablissementOptions();
    if (etablissement_id) {
      setInitialData({ etablissement_id: etablissement_id });
    }
  }, [getEtablissementOptions, etablissement_id, setInitialData]);

  useEffect(() => {
    console.log(etablissementOptions);
  }, [etablissementOptions]);

  const roleFields = getFieldsFromZodObjectSchema(RoleSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id", "scope_json"],

    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      // relation example:
      etablissement_id: {
        relation: {
          options: etablissementOptions,
        },
      },
    },

    labelByField: {
      nom: "Nom",
    },
  });

  const roleSchema = RoleSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    scope_json: true,
  });

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <Form
          schema={roleSchema}
          fields={roleFields}
          initialValues={initialData as Partial<Role>}
          service={service}
          labelMessage={"Role"}
        />
      )}
    </div>
  );
}

export default RoleForm;
