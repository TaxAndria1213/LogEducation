import { useEffect, useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiFileText, FiPlus, FiTrash2 } from "react-icons/fi";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import Spin from "../../../../../components/anim/Spin";
import FactureService from "../../../../../services/facture.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import { useFactureCreateStore } from "../../store/FactureCreateStore";
import { useFactureStore } from "../../store/FactureIndexStore";

type FactureLineForm = {
  catalogue_frais_id: string;
  libelle: string;
  quantite: number;
  prix_unitaire: number;
  montant: number;
};

type FactureFormValues = {
  etablissement_id: string;
  eleve_id: string;
  annee_scolaire_id: string;
  remise_id: string;
  numero_facture: string;
  date_emission: string;
  date_echeance: string;
  statut: "BROUILLON" | "EMISE";
  devise: string;
  lignes: FactureLineForm[];
};

const emptyLine: FactureLineForm = {
  catalogue_frais_id: "",
  libelle: "",
  quantite: 1,
  prix_unitaire: 0,
  montant: 0,
};

const lineSchema = z.object({
  catalogue_frais_id: z.string().optional(),
  libelle: z.string().trim().min(1, "Le libelle de la ligne est requis."),
  quantite: z.coerce.number().int().min(1, "La quantite doit etre au moins 1."),
  prix_unitaire: z.coerce
    .number()
    .min(0, "Le prix unitaire ne peut pas etre negatif.")
    .refine(Number.isFinite, "Le prix unitaire est invalide."),
  montant: z.coerce
    .number()
    .min(0, "Le montant ne peut pas etre negatif.")
    .refine(Number.isFinite, "Le montant est invalide."),
});

const factureSchema = z.object({
  etablissement_id: z.string().min(1, "L'etablissement est requis."),
  eleve_id: z.string().min(1, "L'eleve est requis."),
  annee_scolaire_id: z.string().min(1, "L'annee scolaire est requise."),
  remise_id: z.string().optional(),
  numero_facture: z.string().trim().optional(),
  date_emission: z.string().min(1, "La date d'emission est requise."),
  date_echeance: z.string().optional(),
  statut: z.enum(["BROUILLON", "EMISE"]),
  devise: z.string().trim().min(1, "La devise est requise."),
  lignes: z.array(lineSchema).min(1, "Ajoute au moins une ligne de facture."),
});

type Props = {
  mode?: "create" | "edit";
};

function toInputDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizeEditableStatus(status?: string | null): FactureFormValues["statut"] {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "BROUILLON") return "BROUILLON";
  return "EMISE";
}

export default function FactureForm({ mode = "create" }: Props) {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new FactureService(), []);
  const selectedFacture = useFactureStore((state) => state.selectedFacture);
  const setSelectedFacture = useFactureStore((state) => state.setSelectedFacture);
  const setRenderedComponent = useFactureStore((state) => state.setRenderedComponent);

  const loading = useFactureCreateStore((state) => state.loading);
  const errorMessage = useFactureCreateStore((state) => state.errorMessage);
  const initialData = useFactureCreateStore((state) => state.initialData);
  const anneeScolaireOptions = useFactureCreateStore((state) => state.anneeScolaireOptions);
  const eleveOptions = useFactureCreateStore((state) => state.eleveOptions);
  const catalogueFraisOptions = useFactureCreateStore((state) => state.catalogueFraisOptions);
  const remiseOptions = useFactureCreateStore((state) => state.remiseOptions);
  const getOptions = useFactureCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const defaultValues = useMemo<FactureFormValues>(
    () => ({
      etablissement_id:
        selectedFacture?.etablissement_id ?? initialData?.etablissement_id ?? etablissement_id ?? "",
      eleve_id: selectedFacture?.eleve_id ?? "",
      annee_scolaire_id: selectedFacture?.annee_scolaire_id ?? initialData?.annee_scolaire_id ?? "",
      remise_id: selectedFacture?.remise_id ?? initialData?.remise_id ?? "",
      numero_facture: mode === "edit" ? selectedFacture?.numero_facture ?? "" : "",
      date_emission: toInputDate(selectedFacture?.date_emission ?? new Date()),
      date_echeance: toInputDate(selectedFacture?.date_echeance),
      statut: normalizeEditableStatus(selectedFacture?.statut),
      devise: selectedFacture?.devise ?? initialData?.devise ?? "MGA",
      lignes:
        mode === "edit" && selectedFacture?.lignes?.length
          ? selectedFacture.lignes.map((line) => ({
              catalogue_frais_id: line.catalogue_frais_id ?? "",
              libelle: line.libelle ?? "",
              quantite: Number(line.quantite ?? 1),
              prix_unitaire: Number(line.prix_unitaire ?? 0),
              montant: Number(line.montant ?? 0),
            }))
          : initialData?.lignes?.length
            ? initialData.lignes
            : [{ ...emptyLine }],
    }),
    [etablissement_id, initialData, mode, selectedFacture],
  );

  const form = useForm<FactureFormValues>({
    resolver: zodResolver(factureSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const { control, handleSubmit, formState, watch, setValue, reset } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "lignes",
  });
  const lines = watch("lignes");
  const selectedEleveId = watch("eleve_id");
  const selectedAnneeId = watch("annee_scolaire_id");
  const selectedNiveauId = useMemo(() => {
    const selectedEleve = eleveOptions.find((option) => option.value === selectedEleveId);
    return selectedEleve?.niveauxParAnnee?.[selectedAnneeId ?? ""] ?? null;
  }, [eleveOptions, selectedAnneeId, selectedEleveId]);
  const filteredCatalogueFraisOptions = useMemo(() => {
    if (!selectedNiveauId) {
      return catalogueFraisOptions.filter((option) => !option.niveau_scolaire_id);
    }
    return catalogueFraisOptions.filter(
      (option) =>
        option.niveau_scolaire_id === selectedNiveauId || !option.niveau_scolaire_id,
    );
  }, [catalogueFraisOptions, selectedNiveauId]);
  const total = useMemo(
    () => (lines ?? []).reduce((sum, line) => sum + Number(line?.montant ?? 0), 0),
    [lines],
  );

  const onSubmit = async (data: FactureFormValues) => {
    try {
      const payload = {
        ...data,
        remise_id: data.remise_id?.trim() || null,
        numero_facture: data.numero_facture?.trim() || undefined,
        date_echeance: data.date_echeance?.trim() ? data.date_echeance : null,
        lignes: data.lignes.map((line) => ({
          catalogue_frais_id: line.catalogue_frais_id || null,
          libelle: line.libelle.trim(),
          quantite: Number(line.quantite),
          prix_unitaire: Number(line.prix_unitaire),
          montant: Number(line.montant),
        })),
      };

      if (mode === "edit" && selectedFacture?.id) {
        const response = await service.update(selectedFacture.id, payload);
        setSelectedFacture(response?.data?.data ?? selectedFacture);
        setRenderedComponent("detail");
        info("Facture mise a jour avec succes !", "success");
        return;
      }

      await service.create(payload);
      info("Facture creee avec succes !", "success");
      reset({
        ...defaultValues,
        eleve_id: "",
        numero_facture: "",
        date_emission: toInputDate(new Date()),
        date_echeance: "",
        lignes: [{ ...emptyLine }],
      });
    } catch (error) {
      console.error("Erreur creation facture", error);
      info(mode === "edit" ? "La facture n'a pas pu etre mise a jour." : "La facture n'a pas pu etre creee.", "error");
    }
  };

  return (
    <div className="w-full">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <div className="space-y-5">
          {errorMessage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  {mode === "edit" ? "Modifier la facture" : "Nouvelle facture"}
                </h3>
                <p className="text-sm leading-6 text-slate-500">
                  {mode === "edit"
                    ? "Ajuste les informations de la facture. Le total et le statut seront recales automatiquement."
                    : "Prepare une facture eleve avec ses lignes detaillees. Le total et le statut seront recales automatiquement."}
                </p>
              </div>

        <div className="grid gap-5 md:grid-cols-2">
                <Controller
                  control={control}
                  name="eleve_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="eleve_id"
                      label="Eleve"
                      required
                      error={fieldState.error?.message}
                    >
                      <select
                        id="eleve_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner un eleve</option>
                        {eleveOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="annee_scolaire_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="annee_scolaire_id"
                      label="Annee scolaire"
                      required
                      error={fieldState.error?.message}
                    >
                      <select
                        id="annee_scolaire_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner une annee</option>
                        {anneeScolaireOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="remise_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="remise_id"
                      label="Remise"
                      error={fieldState.error?.message}
                      description="Si une remise est selectionnee, le back ajoute automatiquement la ligne de remise et recalcule le total net."
                    >
                      <select
                        id="remise_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Aucune remise</option>
                        {remiseOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="numero_facture"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="numero_facture"
                      label="Numero de facture"
                      error={fieldState.error?.message}
                      description="Laisse vide pour laisser le back generer le numero automatiquement."
                    >
                      <input
                        id="numero_facture"
                        type="text"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        placeholder="Ex: FAC-2026-0001"
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="devise"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="devise"
                      label="Devise"
                      required
                      error={fieldState.error?.message}
                    >
                      <input
                        id="devise"
                        type="text"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        placeholder="MGA"
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="date_emission"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="date_emission"
                      label="Date d'emission"
                      required
                      error={fieldState.error?.message}
                    >
                      <input
                        id="date_emission"
                        type="date"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="date_echeance"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="date_echeance"
                      label="Date d'echeance"
                      error={fieldState.error?.message}
                    >
                      <input
                        id="date_echeance"
                        type="date"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="statut"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="statut"
                      label="Statut initial"
                      required
                      error={fieldState.error?.message}
                      description="Le statut final pourra ensuite etre recalcule automatiquement selon les paiements."
                    >
                      <select
                        id="statut"
                        value={field.value ?? "EMISE"}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="EMISE">Emise</option>
                        <option value="BROUILLON">Brouillon</option>
                      </select>
                    </FieldWrapper>
                  )}
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Lignes de facture</h3>
                  <p className="text-sm text-slate-500">
                    Ajoute les frais qui composent la facture. Le montant total se recalcule automatiquement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ ...emptyLine })}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <FiPlus />
                  Ajouter une ligne
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {fields.map((item, index) => {
                  const lineError = formState.errors.lignes?.[index];
                  return (
                    <article
                      key={item.id}
                      className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <FiFileText />
                          Ligne {index + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (fields.length === 1) {
                              setValue("lignes.0", { ...emptyLine });
                              return;
                            }
                            remove(index);
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          <FiTrash2 />
                          Retirer
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Controller
                          control={control}
                          name={`lignes.${index}.catalogue_frais_id`}
                          render={({ field, fieldState }) => (
                            <FieldWrapper
                              id={`lignes.${index}.catalogue_frais_id`}
                              label="Frais catalogue"
                              error={fieldState.error?.message}
                              description={
                                selectedNiveauId
                                  ? "Seuls les frais du niveau de l'eleve pour cette annee sont proposes."
                                  : "Choisis d'abord l'eleve et l'annee scolaire pour filtrer les frais du bon niveau."
                              }
                            >
                              <select
                                id={`lignes.${index}.catalogue_frais_id`}
                                value={field.value ?? ""}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  field.onChange(nextValue);
                                  const selected = catalogueFraisOptions.find(
                                    (option) => option.value === nextValue,
                                  );
                                  if (selected) {
                                    setValue(`lignes.${index}.libelle`, selected.label, {
                                      shouldValidate: true,
                                    });
                                    setValue(`lignes.${index}.prix_unitaire`, Number(selected.montant ?? 0), {
                                      shouldValidate: true,
                                    });
                                    const quantity = Number(form.getValues(`lignes.${index}.quantite`) ?? 1);
                                    setValue(
                                      `lignes.${index}.montant`,
                                      Number(selected.montant ?? 0) * quantity,
                                      { shouldValidate: true },
                                    );
                                    if (selected.devise) {
                                      setValue("devise", selected.devise, { shouldValidate: true });
                                    }
                                  }
                                }}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                className={getInputClassName(Boolean(fieldState.error))}
                              >
                                <option value="">Selectionner un frais</option>
                                {filteredCatalogueFraisOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </FieldWrapper>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`lignes.${index}.libelle`}
                          render={({ field, fieldState }) => (
                            <FieldWrapper
                              id={`lignes.${index}.libelle`}
                              label="Libelle"
                              required
                              error={fieldState.error?.message}
                            >
                              <input
                                id={`lignes.${index}.libelle`}
                                type="text"
                                value={field.value ?? ""}
                                onChange={(event) => field.onChange(event.target.value)}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                placeholder="Ex: Frais de scolarite"
                                className={getInputClassName(Boolean(fieldState.error))}
                              />
                            </FieldWrapper>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`lignes.${index}.quantite`}
                          render={({ field, fieldState }) => (
                            <FieldWrapper
                              id={`lignes.${index}.quantite`}
                              label="Quantite"
                              required
                              error={fieldState.error?.message}
                            >
                              <input
                                id={`lignes.${index}.quantite`}
                                type="number"
                                min={1}
                                step={1}
                                value={field.value ?? 1}
                                onChange={(event) => {
                                  const quantity = Number(event.target.value || 1);
                                  field.onChange(quantity);
                                  const unitPrice = Number(form.getValues(`lignes.${index}.prix_unitaire`) ?? 0);
                                  setValue(`lignes.${index}.montant`, quantity * unitPrice, {
                                    shouldValidate: true,
                                  });
                                }}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                className={getInputClassName(Boolean(fieldState.error))}
                              />
                            </FieldWrapper>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`lignes.${index}.prix_unitaire`}
                          render={({ field, fieldState }) => (
                            <FieldWrapper
                              id={`lignes.${index}.prix_unitaire`}
                              label="Prix unitaire"
                              required
                              error={fieldState.error?.message}
                            >
                              <input
                                id={`lignes.${index}.prix_unitaire`}
                                type="number"
                                step="0.01"
                                value={field.value ?? 0}
                                onChange={(event) => {
                                  const unitPrice = Number(event.target.value || 0);
                                  field.onChange(unitPrice);
                                  const quantity = Number(form.getValues(`lignes.${index}.quantite`) ?? 1);
                                  setValue(`lignes.${index}.montant`, quantity * unitPrice, {
                                    shouldValidate: true,
                                  });
                                }}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                className={getInputClassName(Boolean(fieldState.error))}
                              />
                            </FieldWrapper>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`lignes.${index}.montant`}
                          render={({ field, fieldState }) => (
                            <FieldWrapper
                              id={`lignes.${index}.montant`}
                              label="Montant"
                              required
                              error={fieldState.error?.message}
                              className="md:col-span-2"
                            >
                              <input
                                id={`lignes.${index}.montant`}
                                type="number"
                                step="0.01"
                                value={field.value ?? 0}
                                onChange={(event) => field.onChange(Number(event.target.value || 0))}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                className={getInputClassName(Boolean(fieldState.error))}
                              />
                            </FieldWrapper>
                          )}
                        />
                      </div>

                      {lineError && !lineError.libelle && !lineError.quantite && !lineError.prix_unitaire && !lineError.montant ? (
                        <p className="mt-3 text-sm text-rose-600">Ligne incomplete ou invalide.</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Total facture</p>
                    <p className="text-xs text-slate-500">Somme des lignes actuellement saisies.</p>
                  </div>
                  <p className="text-xl font-semibold text-slate-900">
                    {total.toLocaleString("fr-FR")} {watch("devise") || "MGA"}
                  </p>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formState.isSubmitting ? <Spin inline /> : null}
                <span>{mode === "edit" ? "Enregistrer les modifications" : "Enregistrer la facture"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
