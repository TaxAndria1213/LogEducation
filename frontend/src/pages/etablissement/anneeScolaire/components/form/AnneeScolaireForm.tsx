import { useEffect } from "react";
import Spin from "../../../../../components/anim/Spin";
import { Form } from "../../../../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { AnneeScolaireSchema } from "../../../../../generated/zod";
import { useAuth } from "../../../../../hooks/useAuth";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import {
  useAnneeScolaireCreateStore,
  type AnneeScolaireCreateInput,
} from "../../store/AnneeScolaireCreateStore";

function AnneeScolaireForm() {
  const { etablissement_id } = useAuth();
  const loading = useAnneeScolaireCreateStore((state) => state.loading);
  const etablissementOptions = useAnneeScolaireCreateStore(
    (state) => state.etablissementOptions,
  );
  const initialData = useAnneeScolaireCreateStore((state) => state.initialData);
  const setInitialData = useAnneeScolaireCreateStore((state) => state.setInitialData);
  const getEtablissementOptions = useAnneeScolaireCreateStore(
    (state) => state.getEtablissementOptions,
  );

  useEffect(() => {
    if (etablissement_id) {
      setInitialData({ etablissement_id, est_active: true });
      return;
    }

    void getEtablissementOptions();
  }, [etablissement_id, getEtablissementOptions, setInitialData]);

  const omitFieldNames = etablissement_id
    ? ["id", "created_at", "updated_at", "etablissement_id", "est_active"]
    : ["id", "created_at", "updated_at", "est_active"];

  const anneeScolaireFields = getFieldsFromZodObjectSchema(AnneeScolaireSchema, {
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
      etablissement_id: "Etablissement",
      nom: "Nom",
      date_debut: "Date de debut",
      date_fin: "Date de fin",
      est_active: "Annee active",
    },
  });

  const anneeScolaireSchema = AnneeScolaireSchema.omit({
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
          schema={anneeScolaireSchema}
          fields={anneeScolaireFields}
          service={AnneeScolaireService}
          labelMessage="Annee scolaire"
          initialValues={initialData as Partial<AnneeScolaireCreateInput>}
        />
      )}
    </div>
  );
}

export default AnneeScolaireForm;
