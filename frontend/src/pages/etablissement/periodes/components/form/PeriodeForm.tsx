import { useEffect } from "react";
import Spin from "../../../../../components/anim/Spin";
import { Form } from "../../../../../components/Form/Form";
import { getFieldsFromZodObjectSchema } from "../../../../../components/Form/fields";
import { PeriodeSchema } from "../../../../../generated/zod";
import { useAuth } from "../../../../../hooks/useAuth";
import PeriodeService from "../../../../../services/periode.service";
import { usePeriodeCreateStore, type PeriodeCreateInput } from "../../store/PeriodeCreateStore";

function PeriodeForm() {
  const { etablissement_id } = useAuth();
  const loading = usePeriodeCreateStore((state) => state.loading);
  const anneeScolaireOptions = usePeriodeCreateStore(
    (state) => state.anneeScolaireOptions,
  );
  const initialData = usePeriodeCreateStore((state) => state.initialData);
  const getAnneeScolaireOptions = usePeriodeCreateStore(
    (state) => state.getAnneeScolaireOptions,
  );

  useEffect(() => {
    void getAnneeScolaireOptions(etablissement_id);
  }, [etablissement_id, getAnneeScolaireOptions]);

  const periodeFields = getFieldsFromZodObjectSchema(PeriodeSchema, {
    omit: ["id", "created_at", "updated_at"],
    metaByField: {
      created_at: { dateMode: "datetime" },
      updated_at: { dateMode: "datetime" },
      annee_scolaire_id: {
        relation: {
          options: anneeScolaireOptions,
        },
      },
    },
    labelByField: {
      annee_scolaire_id: "Annee scolaire",
      nom: "Nom",
      date_debut: "Date de debut",
      date_fin: "Date de fin",
      ordre: "Ordre",
    },
  });

  const periodeSchema = PeriodeSchema.omit({
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
          schema={periodeSchema}
          fields={periodeFields}
          service={PeriodeService}
          labelMessage="Periode"
          initialValues={initialData as Partial<PeriodeCreateInput>}
        />
      )}
    </div>
  );
}

export default PeriodeForm;
