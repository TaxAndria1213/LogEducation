import { useEffect, useMemo, useState } from "react";
import Spin from "../../../../../components/anim/Spin";
import { Form } from "../../../../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { SalleSchema } from "../../../../../generated/zod";
import { useAuth } from "../../../../../hooks/useAuth";
import ReferencielService, {
  buildReferentialOptions,
  type ReferentialCatalogItem,
} from "../../../../../services/referenciel.service";
import salleService from "../../../../../services/salle.service";
import { useSalleCreateStore, type SalleCreateInput } from "../../store/SalleCreateStore";

function SalleForm() {
  const { etablissement_id } = useAuth();
  const loading = useSalleCreateStore((state) => state.loading);
  const siteOptions = useSalleCreateStore((state) => state.siteOptions);
  const initialData = useSalleCreateStore((state) => state.initialData);
  const getSiteOptions = useSalleCreateStore((state) => state.getSiteOptions);
  const [referentialCatalog, setReferentialCatalog] = useState<
    ReferentialCatalogItem[]
  >([]);

  useEffect(() => {
    void getSiteOptions(etablissement_id);
  }, [etablissement_id, getSiteOptions]);

  useEffect(() => {
    const loadReferentials = async () => {
      const referencielService = new ReferencielService();
      const result = await referencielService.getCatalog();
      if (result?.status.success) {
        setReferentialCatalog((result.data as ReferentialCatalogItem[]) ?? []);
      }
    };

    void loadReferentials();
  }, []);

  const salleTypeOptions = useMemo(
    () =>
      buildReferentialOptions(referentialCatalog, "SALLE_TYPE", [
        "Classe",
        "Laboratoire",
        "Bibliotheque",
        "Bureau",
        "Salle polyvalente",
      ]),
    [referentialCatalog],
  );

  const salleFields = getFieldsFromZodObjectSchema(SalleSchema, {
    omit: ["id", "created_at", "updated_at"],
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      site_id: {
        relation: {
          options: siteOptions,
        },
      },
      type: {
        relation: {
          options: salleTypeOptions,
        },
      },
    },
    labelByField: {
      site_id: "Site",
      nom: "Nom",
      capacite: "Capacite",
      type: "Type",
    },
  });

  const salleSchema = SalleSchema.omit({
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
          schema={salleSchema}
          fields={salleFields}
          service={salleService}
          labelMessage="Salle"
          initialValues={initialData as Partial<SalleCreateInput>}
        />
      )}
    </div>
  );
}

export default SalleForm;
