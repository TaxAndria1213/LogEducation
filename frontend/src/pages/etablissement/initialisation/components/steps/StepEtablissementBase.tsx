import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useForm, useWatch } from "react-hook-form";
import { BooleanField } from "../../../../../components/Form/fields/BooleanField";
import { TextAreaField } from "../../../../../components/Form/fields/TextAreaField";
import { TextField } from "../../../../../components/Form/fields/TextField";
import type { InitialisationSetupDraft } from "../../types";

type Props = {
  draft: InitialisationSetupDraft;
  setDraft: Dispatch<SetStateAction<InitialisationSetupDraft>>;
};

type FormValues = Pick<
  InitialisationSetupDraft,
  | "include_site_principal"
  | "site_principal_nom"
  | "site_principal_telephone"
  | "site_principal_adresse"
>;

function getValuesFromDraft(draft: InitialisationSetupDraft): FormValues {
  return {
    include_site_principal: draft.include_site_principal,
    site_principal_nom: draft.site_principal_nom,
    site_principal_telephone: draft.site_principal_telephone,
    site_principal_adresse: draft.site_principal_adresse,
  };
}

export default function StepEtablissementBase({ draft, setDraft }: Props) {
  const form = useForm<FormValues>({
    defaultValues: getValuesFromDraft(draft),
  });
  const watchedValues = useWatch({ control: form.control });
  const lastSyncRef = useRef(JSON.stringify(getValuesFromDraft(draft)));

  useEffect(() => {
    const nextValues = getValuesFromDraft(draft);
    const nextKey = JSON.stringify(nextValues);

    if (nextKey === lastSyncRef.current) return;

    lastSyncRef.current = nextKey;
    form.reset(nextValues);
  }, [draft, form]);

  useEffect(() => {
    const nextValues = {
      ...getValuesFromDraft(draft),
      ...watchedValues,
    };
    const nextKey = JSON.stringify(nextValues);

    if (nextKey === lastSyncRef.current) return;

    lastSyncRef.current = nextKey;
    setDraft((current) => ({
      ...current,
      ...nextValues,
    }));
  }, [draft, setDraft, watchedValues]);

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
        <p className="text-sm text-slate-600">
          Cette premiere etape pose le socle d'exploitation: site principal et
          coordonnees visibles des equipes.
        </p>
      </div>

      <BooleanField<FormValues>
        control={form.control}
        name="include_site_principal"
        label="Creer ou verifier le site principal"
        description="Le commit cree un site uniquement s'il n'existe pas deja sous ce nom."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TextField<FormValues>
          control={form.control}
          name="site_principal_nom"
          label="Nom du site"
          placeholder="Site principal"
        />

        <TextField<FormValues>
          control={form.control}
          name="site_principal_telephone"
          label="Telephone"
          placeholder="+261 ..."
        />
      </div>

      <TextAreaField<FormValues>
        control={form.control}
        name="site_principal_adresse"
        label="Adresse"
        placeholder="Adresse du campus principal"
      />
    </div>
  );
}
