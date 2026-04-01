import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import LigneTransportService from "../../../../../services/ligneTransport.service";
import ArretTransportService from "../../../../../services/arretTransport.service";
import AbonnementTransportService from "../../../../../services/abonnementTransport.service";
import CatalogueFraisService, {
  type CatalogueFraisWithRelations,
  getCatalogueFraisSecondaryLabel,
  isApprovedCatalogueFrais,
} from "../../../../../services/catalogueFrais.service";
import EleveService from "../../../../../services/eleve.service";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import type {
  AnneeScolaire,
  ArretTransport,
  CatalogueFrais,
  LigneTransport,
} from "../../../../../types/models";

const lineSchema = z.object({
  nom: z.string().min(1, "Le nom est obligatoire."),
  catalogue_frais_id: z.string().min(1, "Le frais catalogue est obligatoire."),
  infos_vehicule_json: z.string().optional(),
});

const stopSchema = z.object({
  ligne_transport_id: z.string().min(1, "La ligne est obligatoire."),
  nom: z.string().min(1, "Le nom est obligatoire."),
  ordre: z.string().optional(),
});

const subscriptionSchema = z.object({
  eleve_id: z.string().min(1, "L'eleve est obligatoire."),
  ligne_transport_id: z.string().min(1, "La ligne est obligatoire."),
  arret_transport_id: z.string().optional(),
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

type TransportAction = "line" | "stop" | "subscription";

function parseVehicleInfo(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Le champ infos vehicule doit contenir un JSON valide.");
  }
}

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
  return "Impossible d'enregistrer l'element transport.";
}

function isTransportFee(record?: Partial<CatalogueFrais> | null) {
  const usageScope = (record?.usage_scope ?? "GENERAL").toUpperCase();
  return usageScope === "GENERAL" || usageScope === "TRANSPORT";
}

function ActionSelector({
  value,
  onChange,
}: {
  value: TransportAction;
  onChange: (value: TransportAction) => void;
}) {
  const actions: Array<{
    id: TransportAction;
    label: string;
    description: string;
  }> = [
    {
      id: "line",
      label: "Ajouter une ligne",
      description: "Creer un circuit ou une ligne de transport.",
    },
    {
      id: "stop",
      label: "Ajouter un arret",
      description: "Rattacher un arret a une ligne existante.",
    },
    {
      id: "subscription",
      label: "Ajouter un abonnement",
      description: "Inscrire un eleve au service de transport.",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
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

export default function TransportForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [activeAction, setActiveAction] = useState<TransportAction>("line");
  const [lignes, setLignes] = useState<LigneTransport[]>([]);
  const [arrets, setArrets] = useState<ArretTransport[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [catalogueFrais, setCatalogueFrais] = useState<CatalogueFraisWithRelations[]>([]);
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<TransportAction | null>(null);
  const lineForm = useForm<z.infer<typeof lineSchema>>({
    resolver: zodResolver(lineSchema),
    defaultValues: { nom: "", catalogue_frais_id: "", infos_vehicule_json: "" },
  });
  const stopForm = useForm<z.infer<typeof stopSchema>>({
    resolver: zodResolver(stopSchema),
    defaultValues: { ligne_transport_id: "", nom: "", ordre: "" },
  });
  const subscriptionForm = useForm<z.infer<typeof subscriptionSchema>>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      eleve_id: "",
      ligne_transport_id: "",
      arret_transport_id: "",
      statut: "ACTIF",
      mode_facturation: "SERVICE_ONLY",
      mode_paiement: "COMPTANT",
      nombre_tranches: 1,
      jour_paiement_mensuel: 5,
      date_echeance: "",
    },
  });

  const selectedLineForSubscription = subscriptionForm.watch("ligne_transport_id");
  const selectedBillingMode = subscriptionForm.watch("mode_facturation");
  const selectedPaymentMode = subscriptionForm.watch("mode_paiement");
  const selectedLine = useMemo(
    () => lignes.find((item) => item.id === selectedLineForSubscription) ?? null,
    [lignes, selectedLineForSubscription],
  );

  const load = useMemo(
    () => async () => {
      if (!etablissement_id) return;
      setLoading(true);
      try {
        const [lignesResult, arretsResult, elevesResult, catalogueFraisResult, activeYear] =
          await Promise.all([
            new LigneTransportService().getForEtablissement(etablissement_id, {
              take: 500,
              includeSpec: JSON.stringify({ frais: true }),
            }),
            new ArretTransportService().getForEtablissement(etablissement_id, {
              take: 1000,
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
                usage_scope: { in: ["GENERAL", "TRANSPORT"] },
              }),
            }),
            AnneeScolaireService.getCurrent(etablissement_id),
          ]);
        setLignes(lignesResult?.status.success ? lignesResult.data.data : []);
        setArrets(arretsResult?.status.success ? arretsResult.data.data : []);
        setEleves(elevesResult?.status.success ? elevesResult.data.data : []);
        setCatalogueFrais(
          (catalogueFraisResult?.status.success ? catalogueFraisResult.data.data : [])
            .filter(isTransportFee)
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

  const visibleStops = useMemo(
    () =>
      arrets.filter(
        (item) =>
          !selectedLineForSubscription ||
          item.ligne_transport_id === selectedLineForSubscription,
      ),
    [arrets, selectedLineForSubscription],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Ajouts transport</h2>
        <p className="mt-2 text-sm text-slate-500">
          Chaque action est maintenant separee pour eviter de melanger creation de
          ligne, d'arret et d'abonnement sur le meme ecran.
        </p>
        <div className="mt-5">
          <ActionSelector value={activeAction} onChange={setActiveAction} />
        </div>
        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Spin label="Chargement du formulaire transport..." showLabel />
          </div>
        ) : null}
      </section>

      {activeAction === "line" ? (
        <form
          onSubmit={lineForm.handleSubmit(async (data) => {
            try {
              setSubmittingAction("line");
              if (!etablissement_id) {
                throw new Error("Aucun etablissement actif n'est disponible.");
              }
              await new LigneTransportService().create({
                etablissement_id,
                nom: data.nom,
                catalogue_frais_id: data.catalogue_frais_id,
                infos_vehicule_json: parseVehicleInfo(data.infos_vehicule_json),
              });
              info("Ligne creee.", "success");
              lineForm.reset({ nom: "", catalogue_frais_id: "", infos_vehicule_json: "" });
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
            <h3 className="text-lg font-semibold text-slate-900">Nouvelle ligne</h3>
            <p className="mt-1 text-sm text-slate-500">
              Cree d'abord la ligne de transport avant d'y rattacher des arrets ou
              des abonnements.
            </p>
          </div>

          <Controller
            control={lineForm.control}
            name="nom"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="transport_line_nom"
                label="Nom"
                required
                error={fieldState.error?.message}
              >
                <input
                  {...field}
                  disabled={loading || submittingAction === "line"}
                  className={getInputClassName(Boolean(fieldState.error))}
                />
              </FieldWrapper>
            )}
          />

          <Controller
            control={lineForm.control}
            name="catalogue_frais_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="transport_line_fee"
                label="Frais catalogue"
                required
                error={fieldState.error?.message}
                hint="Selectionne le frais officiel qui sera reutilise ensuite dans l'inscription et la facturation du transport."
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "line"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="">Selectionner un frais transport</option>
                  {catalogueFrais.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nom} - {getCatalogueFraisSecondaryLabel(item)}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            )}
          />

          <Controller
            control={lineForm.control}
            name="infos_vehicule_json"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="transport_line_infos"
                label="Infos vehicule JSON"
                error={fieldState.error?.message}
              >
                <textarea
                  {...field}
                  disabled={loading || submittingAction === "line"}
                  className={getInputClassName(Boolean(fieldState.error))}
                />
              </FieldWrapper>
            )}
          />

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || submittingAction === "line"}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingAction === "line" ? "Ajout en cours..." : "Ajouter la ligne"}
            </button>
          </div>
        </form>
      ) : null}

      {activeAction === "stop" ? (
        <form
          onSubmit={stopForm.handleSubmit(async (data) => {
            try {
              setSubmittingAction("stop");
              if (!etablissement_id) {
                throw new Error("Aucun etablissement actif n'est disponible.");
              }
              await new ArretTransportService().create({
                etablissement_id,
                ligne_transport_id: data.ligne_transport_id,
                nom: data.nom,
                ordre: data.ordre ? Number(data.ordre) : null,
              });
              info("Arret cree.", "success");
              stopForm.reset({ ligne_transport_id: "", nom: "", ordre: "" });
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
            <h3 className="text-lg font-semibold text-slate-900">Nouvel arret</h3>
            <p className="mt-1 text-sm text-slate-500">
              Cette action est dediee uniquement aux arrets de transport.
            </p>
          </div>

          <Controller
            control={stopForm.control}
            name="ligne_transport_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="transport_stop_line"
                label="Ligne"
                required
                error={fieldState.error?.message}
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "stop"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="">Selectionner une ligne</option>
                  {lignes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            )}
          />

          <Controller
            control={stopForm.control}
            name="nom"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="transport_stop_nom"
                label="Nom"
                required
                error={fieldState.error?.message}
              >
                <input
                  {...field}
                  disabled={loading || submittingAction === "stop"}
                  className={getInputClassName(Boolean(fieldState.error))}
                />
              </FieldWrapper>
            )}
          />

          <Controller
            control={stopForm.control}
            name="ordre"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="transport_stop_order"
                label="Ordre"
                error={fieldState.error?.message}
              >
                <input
                  type="number"
                  min={0}
                  {...field}
                  disabled={loading || submittingAction === "stop"}
                  className={getInputClassName(Boolean(fieldState.error))}
                />
              </FieldWrapper>
            )}
          />

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || submittingAction === "stop"}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingAction === "stop" ? "Ajout en cours..." : "Ajouter l'arret"}
            </button>
          </div>
        </form>
      ) : null}

      {activeAction === "subscription" ? (
        <form
          onSubmit={subscriptionForm.handleSubmit(async (data) => {
            try {
              setSubmittingAction("subscription");
              if (!etablissement_id) {
                throw new Error("Aucun etablissement actif n'est disponible.");
              }
              if (!currentYear?.id) {
                throw new Error("Aucune annee scolaire active n'est disponible.");
              }
              await new AbonnementTransportService().create({
                etablissement_id,
                eleve_id: data.eleve_id,
                annee_scolaire_id: currentYear.id,
                ligne_transport_id: data.ligne_transport_id,
                arret_transport_id: data.arret_transport_id || null,
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
                  ? "Abonnement transport et facture crees."
                  : "Abonnement transport cree.",
                "success",
              );
              subscriptionForm.reset({
                eleve_id: "",
                ligne_transport_id: "",
                arret_transport_id: "",
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
              Nouvel abonnement transport
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Cette vue est reservee a l'inscription d'un eleve au service de
              transport. Tu peux ouvrir le service seul ou generer la facture dans le meme geste.
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
            control={subscriptionForm.control}
            name="eleve_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="transport_subscription_student"
                label="Eleve"
                required
                error={fieldState.error?.message}
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "subscription"}
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
            control={subscriptionForm.control}
            name="ligne_transport_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="transport_subscription_line"
                label="Ligne"
                required
                error={fieldState.error?.message}
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "subscription"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="">Selectionner une ligne</option>
                  {lignes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            )}
          />

          <Controller
            control={subscriptionForm.control}
            name="arret_transport_id"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="transport_subscription_stop"
                label="Arret"
                error={fieldState.error?.message}
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "subscription"}
                  className={getInputClassName(Boolean(fieldState.error))}
                >
                  <option value="">Sans arret</option>
                  {visibleStops.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FieldWrapper>
            )}
          />

          <Controller
            control={subscriptionForm.control}
            name="mode_facturation"
            render={({ field, fieldState }) => (
              <FieldWrapper
                id="transport_subscription_billing_mode"
                label="Activation"
                required
                error={fieldState.error?.message}
              >
                <select
                  {...field}
                  disabled={loading || submittingAction === "subscription"}
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
                  {selectedLine?.frais
                    ? `${selectedLine.frais.nom} - ${getCatalogueFraisSecondaryLabel(selectedLine.frais as CatalogueFraisWithRelations)}`
                    : "Choisis d'abord une ligne reliee a un frais catalogue transport."}
                </p>
              </div>

              <Controller
                control={subscriptionForm.control}
                name="mode_paiement"
                render={({ field, fieldState }) => (
                  <FieldWrapper
                    id="transport_subscription_payment_mode"
                    label="Mode de paiement"
                    required
                    error={fieldState.error?.message}
                  >
                    <select
                      {...field}
                      disabled={loading || submittingAction === "subscription"}
                      className={getInputClassName(Boolean(fieldState.error))}
                    >
                      <option value="COMPTANT">Comptant</option>
                      <option value="ECHELONNE">Echelonne</option>
                    </select>
                  </FieldWrapper>
                )}
              />

              <Controller
                control={subscriptionForm.control}
                name="nombre_tranches"
                render={({ field, fieldState }) => (
                  <FieldWrapper
                    id="transport_subscription_tranches"
                    label="Nombre de tranches"
                    required
                    error={fieldState.error?.message}
                    hint="Pour un paiement echelonne, le service sera divise en echeances mensuelles."
                  >
                    <input
                      type="number"
                      min={1}
                      {...field}
                      disabled={loading || submittingAction === "subscription"}
                      className={getInputClassName(Boolean(fieldState.error))}
                    />
                  </FieldWrapper>
                )}
              />

              {selectedPaymentMode === "ECHELONNE" ? (
                <Controller
                  control={subscriptionForm.control}
                  name="jour_paiement_mensuel"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="transport_subscription_payment_day"
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
                        disabled={loading || submittingAction === "subscription"}
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />
              ) : null}

              <Controller
                control={subscriptionForm.control}
                name="date_echeance"
                render={({ field, fieldState }) => (
                  <FieldWrapper
                    id="transport_subscription_due_date"
                    label="Premiere date d'echeance"
                    error={fieldState.error?.message}
                    hint="Optionnelle. Sert d'ancre pour la premiere echeance du service."
                  >
                    <input
                      type="date"
                      {...field}
                      disabled={loading || submittingAction === "subscription"}
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
              disabled={!currentYear?.id || loading || submittingAction === "subscription"}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingAction === "subscription"
                ? "Ajout en cours..."
                : "Ajouter l'abonnement"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
