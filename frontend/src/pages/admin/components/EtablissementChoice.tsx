import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useEtablissementChoiceStore } from "../store/EtablissementChoiceStore";
import { SelectField } from "../../../components/Form/fields/SelectField";

type FormValues = {
  etablissementId?: string; // ou number si tu préfères, voir note plus bas
};

function EtablissementChoice() {
  const etablissementList = useEtablissementChoiceStore(
    (state) => state.etablissementList,
  );
  const etablissementId = useEtablissementChoiceStore(
    (state) => state.etablissementId,
  );
  const getEtablissementList = useEtablissementChoiceStore(
    (state) => state.getEtablissementList,
  );
  const setEtablissementId = useEtablissementChoiceStore(
    (state) => state.setEtablissementId,
  );

  useEffect(() => {
    getEtablissementList();
  }, [getEtablissementList]);

  const { control, watch } = useForm<FormValues>({
    defaultValues: { etablissementId: etablissementId || undefined },
  });

  // Sync avec le store à chaque changement
  useEffect(() => {
    const subscription = watch((value) => {
      setEtablissementId(value.etablissementId || null);
    });
    return () => subscription.unsubscribe();
  });

  return (
    <div>
      <SelectField<FormValues, string>
        control={control}
        name="etablissementId"
        emptyLabel="Choisir un établissement"
        options={etablissementList.map((e) => ({
          value: String(e.id),
          label: e.nom,
        }))}
      />
    </div>
  );
}

export default EtablissementChoice;
