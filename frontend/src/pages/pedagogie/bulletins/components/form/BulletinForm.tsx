import { useEffect } from "react";
import { useAuth } from "../../../../../auth/AuthContext";
import Spin from "../../../../../components/anim/Spin";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { BulletinSchema } from "../../../../../generated/zod";
import BulletinService from "../../../../../services/bulletin.service";
import { useBulletinCreateStore } from "../../store/BulletinCreateStore";
import type { Bulletin } from "@prisma/client";

function BulletinForm() {
  const { etablissement_id } = useAuth();
  const service = new BulletinService();

  const loading = useBulletinCreateStore((state) => state.loading);
  const initialData = useBulletinCreateStore((state) => state.initialData);
  const eleveOptions = useBulletinCreateStore((state) => state.eleveOptions);
  const periodeOptions = useBulletinCreateStore((state) => state.periodeOptions);

  const getOptions = useBulletinCreateStore((state) => state.getOptions);
  const onCreate = useBulletinCreateStore((state) => state.onCreate);

  useEffect(() => {
    if (etablissement_id) getOptions(etablissement_id);
  }, [etablissement_id, getOptions]);

  const bulletinFields = getFieldsFromZodObjectSchema(BulletinSchema, {
    omit: ["id", "created_at", "updated_at", "classe_id"],
    metaByField: {
      publie_le: { dateMode: "datetime" },
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      eleve_id: {
        relation: {
          options: eleveOptions
        }
      },
      periode_id: {
        relation: {
          options: periodeOptions
        }
      }
    },
    labelByField: {
      eleve_id: "élève",
      periode_id: "Période",
      classe_id: "Classe",
      publie_le: "Publié le",
      statut: "Statut",
    },
  });

  const bulletinSchema = BulletinSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    classe_id: true
  });

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement..." showLabel />
      ) : (
        <Form
          dataOnly={onCreate}
          schema={bulletinSchema}
          fields={bulletinFields}
          service={service}
          initialValues={initialData as Partial<Bulletin>}
          labelMessage={"Bulletin"}
        />
      )}
    </div>
  );
}

export default BulletinForm;
