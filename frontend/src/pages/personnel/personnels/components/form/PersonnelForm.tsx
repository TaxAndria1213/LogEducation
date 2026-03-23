import { useEffect, useMemo, useState } from "react";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { PersonnelSchema } from "../../../../../generated/zod";
import PersonnelService from "../../../../../services/personnel.service";
import ReferencielService, {
  buildReferentialOptions,
  type ReferentialCatalogItem,
} from "../../../../../services/referenciel.service";
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
  const [referentialCatalog, setReferentialCatalog] = useState<
    ReferentialCatalogItem[]
  >([]);

  useEffect(() => {
    if (etablissement_id) {
      setInitialData({ etablissement_id });
    }
  }, [etablissement_id, setInitialData]);

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

  const statutOptions = useMemo(
    () =>
      buildReferentialOptions(referentialCatalog, "PERSONNEL_STATUT", [
        "ACTIF",
        "EN_CONGE",
        "SUSPENDU",
        "SORTI",
      ]),
    [referentialCatalog],
  );

  const posteOptions = useMemo(
    () =>
      buildReferentialOptions(referentialCatalog, "PERSONNEL_POSTE", [
        "Directeur",
        "Secretaire scolaire",
        "Comptable",
        "Surveillant",
        "Professeur",
      ]),
    [referentialCatalog],
  );

  const personnelFields = getFieldsFromZodObjectSchema(PersonnelSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id"],
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      date_embauche: { dateMode: "date" },
      statut: {
        relation: {
          options: statutOptions,
        },
      },
      poste: {
        relation: {
          options: posteOptions,
        },
      },
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
