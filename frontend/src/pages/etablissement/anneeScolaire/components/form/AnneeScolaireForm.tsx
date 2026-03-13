import { useEffect } from "react";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { Form } from "../../../../../components/Form/Form";
import { AnneeScolaireSchema } from "../../../../../generated/zod";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import { useAnneeScolaireCreateStore, type AnneeScolaireCreateInput } from "../../store/AnneeScolaireCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";

function AnneeScolaireForm() {
  const {etablissement_id} = useAuth();
  const service = AnneeScolaireService;
  const loading = useAnneeScolaireCreateStore((state) => state.loading);
  const etablissementOptions = useAnneeScolaireCreateStore(
    (state) => state.etablissementOptions,
  );

  const initialData = useAnneeScolaireCreateStore((state) => state.initialData);

  const setInitialData = useAnneeScolaireCreateStore(
    (state) => state.setInitialData,
  );


  const getEtablissementOptions = useAnneeScolaireCreateStore(
    (state) => state.getEtablissementOptions,
  );

  useEffect(() => {
    getEtablissementOptions();
    if (etablissement_id) {
      setInitialData({ etablissement_id: etablissement_id, est_active: true });
    }
  }, [getEtablissementOptions, etablissement_id, setInitialData]);

  const AnneeScolaireFields = getFieldsFromZodObjectSchema(AnneeScolaireSchema, {
    omit: ["id", "created_at", "updated_at", "etablissement_id", "est_active"],

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
      date_debut: "Date de debut",
      date_fin: "Date de fin",
    },
  });

  const anneeScolaireSchema = AnneeScolaireSchema.omit({
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
          schema={anneeScolaireSchema}
          fields={AnneeScolaireFields}
          service={service}
          labelMessage={"Année scolaire"}
          initialValues={initialData as Partial<AnneeScolaireCreateInput>}
        />
      )}
    </div>
  );
}

export default AnneeScolaireForm;
