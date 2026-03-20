import { useEffect } from "react";
import Spin from "../../../../../components/anim/Spin";
import { Form } from "../../../../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { SiteSchema } from "../../../../../generated/zod";
import { useAuth } from "../../../../../hooks/useAuth";
import SiteService from "../../../../../services/site.service";
import { useSiteCreateStore, type SiteCreateInput } from "../../store/SiteCreateStore";

function SiteForm() {
  const { etablissement_id } = useAuth();
  const service = new SiteService();
  const loading = useSiteCreateStore((state) => state.loading);
  const etablissementOptions = useSiteCreateStore(
    (state) => state.etablissementOptions,
  );
  const initialData = useSiteCreateStore((state) => state.initialData);
  const setInitialData = useSiteCreateStore((state) => state.setInitialData);
  const getEtablissementOptions = useSiteCreateStore(
    (state) => state.getEtablissementOptions,
  );

  useEffect(() => {
    if (etablissement_id) {
      setInitialData({ etablissement_id });
      return;
    }

    void getEtablissementOptions();
  }, [etablissement_id, getEtablissementOptions, setInitialData]);

  const omitFieldNames = etablissement_id
    ? ["id", "created_at", "updated_at", "etablissement_id"]
    : ["id", "created_at", "updated_at"];

  const siteFields = getFieldsFromZodObjectSchema(SiteSchema, {
    omit: omitFieldNames,
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      etablissement_id: {
        relation: {
          options: etablissementOptions,
        },
      },
    },
    labelByField: {
      nom: "Nom",
      etablissement_id: "Etablissement",
      telephone: "Telephone",
      adresse: "Adresse",
    },
  });

  const siteSchema = SiteSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
  });

  return (
    <div className="w-full">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <Form
          schema={siteSchema}
          fields={siteFields}
          service={service}
          labelMessage="Site"
          initialValues={initialData as Partial<SiteCreateInput>}
        />
      )}
    </div>
  );
}

export default SiteForm;
