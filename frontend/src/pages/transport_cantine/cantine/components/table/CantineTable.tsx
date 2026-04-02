import { useEffect, useMemo, useState } from "react";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import FormuleCantineService from "../../../../../services/formuleCantine.service";
import {
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";
import AbonnementCantineService, {
  type AbonnementCantineWithRelations,
} from "../../../../../services/abonnementCantine.service";
import type { FormuleCantine } from "../../../../../types/models";

type CantineListMode = "formules" | "abonnements";

function getErrorMessage(error: unknown) {
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
  return "Impossible de charger les donnees cantine.";
}

function ModeSelector({
  value,
  onChange,
}: {
  value: CantineListMode;
  onChange: (value: CantineListMode) => void;
}) {
  const items: Array<{ id: CantineListMode; label: string }> = [
    { id: "formules", label: "Formules" },
    { id: "abonnements", label: "Services eleves" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CantineTable() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new AbonnementCantineService(), []);
  const [mode, setMode] = useState<CantineListMode>("formules");
  const [formules, setFormules] = useState<FormuleCantine[]>([]);
  const [abonnements, setAbonnements] = useState<AbonnementCantineWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!etablissement_id) return;
    setLoading(true);
    try {
      const [formulesResult, abonnementsResult] = await Promise.all([
        new FormuleCantineService().getForEtablissement(etablissement_id, {
          take: 500,
          includeSpec: JSON.stringify({ frais: true }),
        }),
        service.getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            annee: true,
            formule: true,
          }),
        }),
      ]);
      setFormules(formulesResult?.status.success ? formulesResult.data.data : []);
      setAbonnements(abonnementsResult?.status.success ? abonnementsResult.data.data : []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [etablissement_id]);

  const financePendingCount = useMemo(
    () =>
      abonnements.filter(
        (item) =>
          ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"].includes(
            (item.finance_status ?? item.statut ?? "").toUpperCase(),
          ),
      ).length,
    [abonnements],
  );

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Liste cantine</h3>
            <p className="mt-1 text-sm text-slate-500">
              Le module cantine gere les formules et le droit d'acces au service. La facturation et les paiements restent dans Finance.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              A regulariser dans Finance
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{financePendingCount}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <ModeSelector value={mode} onChange={setMode} />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Actualisation..." : "Actualiser"}
          </button>
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Spin label="Chargement de la liste cantine..." showLabel />
          </div>
        ) : null}
      </section>

      {mode === "formules" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Formules de cantine</h3>
          <div className="mt-4 space-y-3">
            {formules.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.nom}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.frais
                        ? `${item.frais.nom} - ${getCatalogueFraisSecondaryLabel(item.frais as CatalogueFraisWithRelations)}`
                        : "Aucun frais catalogue relie"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setBusyId(item.id);
                        await new FormuleCantineService().delete(item.id);
                        info("Formule supprimee.", "success");
                        await load();
                      } catch (error) {
                        info(getErrorMessage(error), "error");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    disabled={busyId === item.id}
                    className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyId === item.id ? "Suppression..." : "Supprimer"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "abonnements" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Services cantine eleves</h3>
          <div className="mt-4 space-y-3">
            {abonnements.map((item) => {
              const financeLinked = Boolean(item.facture_id);
              const financeStatus = (item.finance_status ?? item.facture?.statut ?? "N/A").toUpperCase();
              const serviceStatus = (item.statut ?? "EN_ATTENTE_VALIDATION_FINANCIERE").toUpperCase();

              return (
                <div
                  key={item.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.eleve?.utilisateur?.profil?.prenom} {item.eleve?.utilisateur?.profil?.nom}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.formule?.nom} - {item.annee?.nom ?? "Annee"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Date d'effet: {item.date_effet ? new Date(item.date_effet).toLocaleDateString("fr-FR") : "Non renseignee"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Statut service: {item.statut ?? "EN_ATTENTE_VALIDATION_FINANCIERE"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {financeLinked
                          ? `Finance: ${item.facture?.numero_facture ?? "Facture"} - ${financeStatus}`
                          : `Finance: ${financeStatus}`}
                      </p>
                      {!financeLinked &&
                      ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"].includes(serviceStatus) ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Ce service est en attente de prise en charge ou de validation Finance.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setBusyId(item.id);
                            const nextStatus = serviceStatus === "SUSPENDU" ? "ACTIF" : "SUSPENDU";
                            await service.update(item.id, { statut: nextStatus });
                            info(
                              nextStatus === "SUSPENDU"
                                ? "Service cantine suspendu."
                                : "Service cantine reactive.",
                              "success",
                            );
                            await load();
                          } catch (error) {
                            info(getErrorMessage(error), "error");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === item.id || serviceStatus === "RESILIE"}
                        className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === item.id
                          ? "Traitement..."
                          : serviceStatus === "SUSPENDU"
                            ? "Reactiver"
                            : "Suspendre"}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setBusyId(item.id);
                            await service.delete(item.id);
                            info(
                              item.facture_id
                                ? "Abonnement cantine resilie. La regularisation suit le flux Finance."
                                : "Abonnement cantine supprime.",
                              "success",
                            );
                            await load();
                          } catch (error) {
                            info(getErrorMessage(error), "error");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === item.id}
                        className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === item.id ? "Traitement..." : item.facture_id ? "Resilier" : "Supprimer"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
