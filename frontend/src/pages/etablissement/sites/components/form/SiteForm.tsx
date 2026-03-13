import { useEffect } from "react";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { SiteSchema } from "../../../../../generated/zod";
import SiteService from "../../../../../services/site.service";
import { useSiteCreateStore, type SiteCreateInput } from "../../store/SiteCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";

function SiteForm() {
  const {etablissement_id} = useAuth();
  const service = new SiteService();
  const loading = useSiteCreateStore((state) => state.loading);
  const etablissementOptions = useSiteCreateStore(
    (state) => state.etablissementOptions,
  );

  const initialData = useSiteCreateStore((state) => state.initialData);

  const setInitialData = useSiteCreateStore(
    (state) => state.setInitialData,
  );


  const getEtablissementOptions = useSiteCreateStore(
    (state) => state.getEtablissementOptions,
  );

  useEffect(() => {
    getEtablissementOptions();
    if (etablissement_id) {
      setInitialData({ etablissement_id: etablissement_id });
    }
  }, [getEtablissementOptions, etablissement_id, setInitialData]);


  const siteFields = getFieldsFromZodObjectSchema(SiteSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],

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
      etablissement_id: "Etablissement",
      telephone: "Téléphone",
      adresse: "Adresse",
    },
  });

  const siteSchema = SiteSchema.omit({
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
          schema={siteSchema}
          fields={siteFields}
          service={service}
          labelMessage={"Site"}
          initialValues={initialData as Partial<SiteCreateInput>}
        />
      )}
    </div>
  );
}

export default SiteForm;
