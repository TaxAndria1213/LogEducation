import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import FormuleCantineService from "../../../../../services/formuleCantine.service";
import AbonnementCantineService from "../../../../../services/abonnementCantine.service";
import CatalogueFraisService, {
  type CatalogueFraisWithRelations,
  getCatalogueFraisSecondaryLabel,
  isApprovedCatalogueFrais,
} from "../../../../../services/catalogueFrais.service";
import EleveService from "../../../../../services/eleve.service";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import type { AnneeScolaire, CatalogueFrais, FormuleCantine } from "../../../../../types/models";

const formuleSchema = z.object({
  nom: z.string().min(1, "Le nom est obligatoire."),
  catalogue_frais_id: z.string().min(1, "Le frais catalogue est obligatoire."),
});

const abonnementSchema = z.object({
  eleve_id: z.string().min(1, "L'eleve est obligatoire."),
  formule_cantine_id: z.string().min(1, "La formule est obligatoire."),
  statut: z.string().default("ACTIF"),
  mode_facturation: z.enum(["SERVICE_ONLY", "SERVICE_AND_BILL"]).default("SERVICE_ONLY"),
  mode_paiement: z.enum(["COMPTANT", "ECHELONNE"]).default("COMPTANT"),
  nombre_tranches: z.coerce.number().int().min(1).default(1),
  jour_paiement_mensuel: z.coerce.number().int().min(1).max(28).nullable().optional(),
  date_echeance: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.mode_facturation === "SERVICE_AND_BILL" && data.mode_paiement === "ECHELONNE" && !data.jour_paiement_mensuel) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["jour_paiement_mensuel"],
      message: "Le jour du mois est requis pour un paiement echelonne.",
    });
  }
});

type CantineAction = "formule" | "abonnement";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }
  return "Impossible d'enregistrer l'element cantine.";
}

function isCantineFee(record?: Partial<CatalogueFrais> | null) {
  const usageScope = (record?.usage_scope ?? "GENERAL").toUpperCase();
  return usageScope === "GENERAL" || usageScope === "CANTINE";
}

function ActionSelector({
  value,
  onChange,
}: {
  value: CantineAction;
  onChange: (value: CantineAction) => void;
}) {
  const actions: Array<{
    id: CantineAction;
    label: string;
    description: string;
  }> = [
    {
      id: "formule",
      label: "Ajouter une formule",
      description: "Creer une formule ou un tarif cantine.",
    },
    {
      id: "abonnement",
      label: "Ajouter un abonnement",
      description: "Rattacher un eleve a une formule cantine.",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {actions.map((action) => {
        const active = action.id === value;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onChange(action.id)}
            className={`rounded-[22px] border px-4 py-4 text-left transition ${
              active
                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold">{action.label}</p>
            <p className={`mt-2 text-xs leading-5 ${active ? "text-slate-200" : "text-slate-500"}`}>
              {action.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export default function CantineForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [activeAction, setActiveAction] = useState<CantineAction>("formule");
  const [formules, setFormules] = useState<FormuleCantine[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [catalogueFrais, setCatalogueFrais] = useState<CatalogueFraisWithRelations[]>([]);
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<CantineAction | null>(null);
  const formuleForm = useForm<z.infer<typeof formuleSchema>>({
    resolver: zodResolver(formuleSchema),
    defaultValues: { nom: "", catalogue_frais_id: "" },
  });
  const abonnementForm = useForm<z.infer<typeof abonnementSchema>>({
    resolver: zodResolver(abonnementSchema),
    defaultValues: {
      eleve_id: "",
      formule_cantine_id: "",
      statut: "ACTIF",
      mode_facturation: "SERVICE_ONLY",
      mode_paiement: "COMPTANT",
      nombre_tranches: 1,
      jour_paiement_mensuel: 5,
      date_echeance: "",
    },
  });
  const selectedBillingMode = abonnementForm.watch("mode_facturation");
  const selectedPaymentMode = abonnementForm.watch("mode_paiement");
  const selectedFormuleId = abonnementForm.watch("formule_cantine_id");

  const load = useMemo(
    () => async () => {
      if (!etablissement_id) return;
      setLoading(true);
      try {
        const [formulesResult, elevesResult, catalogueFraisResult, activeYear] = await Promise.all([
          new FormuleCantineService().getForEtablissement(etablissement_id, {
            take: 500,
            includeSpec: JSON.stringify({ frais: true }),
          }),
          new EleveService().getAll({
            take: 500,
            where: JSON.stringify({ etablissement_id }),
            includeSpec: JSON.stringify({
              utilisateur: { include: { profil: true } },
            }),
          }),
          new CatalogueFraisService().getForEtablissement(etablissement_id, {
            take: 500,
            where: JSON.stringify({
              usage_scope: { in: ["GENERAL", "CANTINE"] },
            }),
          }),
          AnneeScolaireService.getCurrent(etablissement_id),
        ]);
        setFormules(formulesResult?.status.success ? formulesResult.data.data : []);
        setEleves(elevesResult?.status.success ? elevesResult.data.data : []);
        setCatalogueFrais(
          (catalogueFraisResult?.status.success ? catalogueFraisResult.data.data : [])
            .filter(isCantineFee)
            .filter(isApprovedCatalogueFrais),
        );
        setCurrentYear((activeYear as AnneeScolaire | null) ?? null);
      } finally {
        setLoading(false);
      }
    },
    [etablissement_id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selectedFormule = useMemo(
    () => formules.find((item) => item.id === selectedFormuleId) ?? null,
    [formules, selectedFormuleId],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Ajouts cantine</h2>
        <p className="mt-2 text-sm text-slate-500">
          Les actions formule et abonnement sont maintenant separees pour rendre le
          parcours plus clair.
        </p>
        <div className="mt-5">
          <ActionSelector value={activeAction} onChange={setActiveAction} />
        </div>
        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Spin label="Chargement du formulaire cantine..." showLabel />
          </div>
        ) : null}
      </section>

      {activeAction === "formule" ? (
        <form
          onSubmit={formuleForm.handleSubmit(async (data) => {
            try {
              setSubmittingAction("formule");
              if (!etablissement_id) {
                throw new Error("Aucun etablissement actif n'est disponible.");
              }
              await new FormuleCantineService().create({
                etablissement_id,
                nom: data.nom,
                catalogue_frais_id: data.catalogue_frais_id,
              });
              info("Formule creee.", "success");
              formuleForm.reset({ nom: "", catalogue_frais_id: "" });
              await load();
            } catch (error) {
              info(getErrorMessage(error), "error");
            } finally {
              setSubmittingAction(null);
            }
          })}
          className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900">Nouvelle formule</h3>
            <p className="mt-1 text-sm text-slate-500">
              Cette vue est dediee a la creation des formules de cantine. Le tarif officiel vient directement du catalogue de frais, donc il n'est plus ressaisi ici.
            </p>
          </div>

          <Controller
            control={formuleForm.control}
            name="nom"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="cantine_formule_nom"
                label="Nom"
                required
                error={fieldState.error?.message}
              >
                <input
                  {...field}
                  disabled={loading || submittingAction === "formule"}
                  className={getInputClassName(Boolean(fieldState.error))}
                />
              </FieldWrapper>
            )}
          />

          <Controller
            control={formuleForm.control}
            name="catalogue_frais_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="cantine_formule_frais"
                label="Frais catalogue"
                required
                error={fieldState.error?.message}
                hint="Selectionne un frais du catalogue avec un usage cantine."
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "formule"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="">Selectionner un frais cantine</option>
                  {catalogueFrais.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nom} - {getCatalogueFraisSecondaryLabel(item)}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            )}
          />

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || submittingAction === "formule"}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingAction === "formule" ? "Ajout en cours..." : "Ajouter la formule"}
            </button>
          </div>
        </form>
      ) : null}

      {activeAction === "abonnement" ? (
        <form
          onSubmit={abonnementForm.handleSubmit(async (data) => {
            try {
              setSubmittingAction("abonnement");
              if (!etablissement_id) {
                throw new Error("Aucun etablissement actif n'est disponible.");
              }
              if (!currentYear?.id) {
                throw new Error("Aucune annee scolaire active n'est disponible.");
              }
              await new AbonnementCantineService().create({
                etablissement_id,
                eleve_id: data.eleve_id,
                annee_scolaire_id: currentYear.id,
                formule_cantine_id: data.formule_cantine_id,
                statut: data.statut || "ACTIF",
                facturer_maintenant: data.mode_facturation === "SERVICE_AND_BILL",
                mode_paiement: data.mode_paiement,
                nombre_tranches:
                  data.mode_facturation === "SERVICE_AND_BILL"
                    ? Number(data.nombre_tranches ?? 1)
                    : 1,
                jour_paiement_mensuel:
                  data.mode_facturation === "SERVICE_AND_BILL" && data.mode_paiement === "ECHELONNE"
                    ? Number(data.jour_paiement_mensuel ?? 5)
                    : null,
                date_echeance:
                  data.mode_facturation === "SERVICE_AND_BILL"
                    ? data.date_echeance || null
                    : null,
              });
              info(
                data.mode_facturation === "SERVICE_AND_BILL"
                  ? "Abonnement cantine et facture crees."
                  : "Abonnement cantine cree.",
                "success",
              );
              abonnementForm.reset({
                eleve_id: "",
                formule_cantine_id: "",
                statut: "ACTIF",
                mode_facturation: "SERVICE_ONLY",
                mode_paiement: "COMPTANT",
                nombre_tranches: 1,
                jour_paiement_mensuel: 5,
                date_echeance: "",
              });
              await load();
            } catch (error) {
              info(getErrorMessage(error), "error");
            } finally {
              setSubmittingAction(null);
            }
          })}
          className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900">
              Nouvel abonnement cantine
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Cette vue est reservee au rattachement d'un eleve a une formule
              cantine. Tu peux ouvrir le service seul ou declencher la facture en meme temps.
              Si le frais lie est recurrent, un service actif pourra ensuite etre repris par la facturation automatique.
            </p>
          </div>

          <div className="md:col-span-2 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Annee scolaire appliquee
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {currentYear?.nom ?? "Aucune annee scolaire active"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              L'abonnement sera automatiquement rattache a l'annee scolaire active de l'etablissement.
            </p>
          </div>

          <Controller
            control={abonnementForm.control}
            name="eleve_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="cantine_subscription_student"
                label="Eleve"
                required
                error={fieldState.error?.message}
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "abonnement"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="">Selectionner un eleve</option>
                  {eleves.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code_eleve} {item.utilisateur?.profil?.prenom}{" "}
                      {item.utilisateur?.profil?.nom}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            )}
          />

          <Controller
            control={abonnementForm.control}
            name="formule_cantine_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="cantine_subscription_formule"
                label="Formule"
                required
                error={fieldState.error?.message}
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "abonnement"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="">Selectionner une formule</option>
                  {formules.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            )}
          />

          <Controller
            control={abonnementForm.control}
            name="mode_facturation"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="cantine_subscription_billing_mode"
                label="Activation"
                required
                error={fieldState.error?.message}
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "abonnement"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="SERVICE_ONLY">Activer sans facture immediate</option>
                  <option value="SERVICE_AND_BILL">Activer et facturer maintenant</option>
                </select>
              </FieldWrapper>
            )}
          />

          {selectedBillingMode === "SERVICE_AND_BILL" ? (
            <>
              <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900 md:col-span-2">
                <p className="font-semibold">Tarif applique automatiquement</p>
                <p className="mt-1">
                  {selectedFormule?.frais
                    ? `${selectedFormule.frais.nom} - ${getCatalogueFraisSecondaryLabel(selectedFormule.frais as CatalogueFraisWithRelations)}`
                    : "Choisis d'abord une formule reliee a un frais catalogue cantine."}
                </p>
              </div>

              <Controller
                control={abonnementForm.control}
                name="mode_paiement"
                render={({ field, fieldState }) => (
                  <FieldWrapper
                    id="cantine_subscription_payment_mode"
                    label="Mode de paiement"
                    required
                    error={fieldState.error?.message}
                  >
                    <select
                      {...field}
                      disabled={loading || submittingAction === "abonnement"}
                      className={getInputClassName(Boolean(fieldState.error))}
                    >
                      <option value="COMPTANT">Comptant</option>
                      <option value="ECHELONNE">Echelonne</option>
                    </select>
                  </FieldWrapper>
                )}
              />

              <Controller
                control={abonnementForm.control}
                name="nombre_tranches"
                render={({ field, fieldState }) => (
                  <FieldWrapper
                    id="cantine_subscription_tranches"
                    label="Nombre de tranches"
                    required
                    error={fieldState.error?.message}
                    hint="Pour un paiement echelonne, le service sera decoupe en plusieurs echeances mensuelles."
                  >
                    <input
                      type="number"
                      min={1}
                      {...field}
                      disabled={loading || submittingAction === "abonnement"}
                      className={getInputClassName(Boolean(fieldState.error))}
                    />
                  </FieldWrapper>
                )}
              />

              {selectedPaymentMode === "ECHELONNE" ? (
                <Controller
                  control={abonnementForm.control}
                  name="jour_paiement_mensuel"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="cantine_subscription_payment_day"
                      label="Jour de paiement du mois"
                      required
                      error={fieldState.error?.message}
                    >
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === "" ? null : Number(event.target.value),
                          )
                        }
                        disabled={loading || submittingAction === "abonnement"}
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />
              ) : null}

              <Controller
                control={abonnementForm.control}
                name="date_echeance"
                render={({ field, fieldState }) => (
                  <FieldWrapper
                    id="cantine_subscription_due_date"
                    label="Premiere date d'echeance"
                    error={fieldState.error?.message}
                    hint="Optionnelle. Sert d'ancre pour la premiere echeance du service."
                  >
                    <input
                      type="date"
                      {...field}
                      disabled={loading || submittingAction === "abonnement"}
                      className={getInputClassName(Boolean(fieldState.error))}
                    />
                  </FieldWrapper>
                )}
              />
            </>
          ) : null}

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={!currentYear?.id || loading || submittingAction === "abonnement"}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingAction === "abonnement"
                ? "Ajout en cours..."
                : "Ajouter l'abonnement"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
