import { useEffect, useMemo, useState } from "react";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import LigneTransportService from "../../../../../services/ligneTransport.service";
import ArretTransportService from "../../../../../services/arretTransport.service";
import {
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";
import AbonnementTransportService, {
  getAbonnementTransportProrataLabel,
  type AbonnementTransportWithRelations,
} from "../../../../../services/abonnementTransport.service";
import type { ArretTransport, LigneTransport } from "../../../../../types/models";

type TransportListMode = "lines" | "stops" | "subscriptions";
type ChangeLineState = {
  ligne_transport_id: string;
  arret_transport_id: string;
  date_effet: string;
  facturer_regularisation: boolean;
};

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
  return "Impossible de charger les donnees transport.";
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Non precise";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non precise";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getServiceStatusLabel(value?: string | null) {
  const normalized = (value ?? "").toUpperCase();
  switch (normalized) {
    case "EN_ATTENTE_VALIDATION_FINANCIERE":
      return "En attente Finance";
    case "EN_ATTENTE_REGLEMENT":
      return "En attente reglement";
    case "ACTIF":
      return "Actif";
    case "SUSPENDU":
      return "Suspendu";
    case "RESILIE":
      return "Resilie";
    case "ANNULE":
      return "Annule";
    case "INACTIF":
      return "Inactif";
    default:
      return value || "Actif";
  }
}

function ModeSelector({
  value,
  onChange,
}: {
  value: TransportListMode;
  onChange: (value: TransportListMode) => void;
}) {
  const items: Array<{ id: TransportListMode; label: string }> = [
    { id: "lines", label: "Lignes" },
    { id: "stops", label: "Arrets" },
    { id: "subscriptions", label: "Abonnements" },
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

export default function TransportTable() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [mode, setMode] = useState<TransportListMode>("lines");
  const [lignes, setLignes] = useState<LigneTransport[]>([]);
  const [arrets, setArrets] = useState<(ArretTransport & {
    ligne?: LigneTransport | null;
  })[]>([]);
  const [abonnements, setAbonnements] = useState<AbonnementTransportWithRelations[]>(
    [],
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null);
  const [changeLineState, setChangeLineState] = useState<ChangeLineState>({
    ligne_transport_id: "",
    arret_transport_id: "",
    date_effet: getTodayInputValue(),
    facturer_regularisation: true,
  });

  const load = async () => {
    if (!etablissement_id) return;
    setLoading(true);
    try {
      const [lignesResult, arretsResult, abonnementsResult] = await Promise.all([
        new LigneTransportService().getForEtablissement(etablissement_id, {
          take: 500,
          includeSpec: JSON.stringify({ frais: true }),
        }),
        new ArretTransportService().getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({ ligne: true }),
        }),
        new AbonnementTransportService().getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            annee: true,
            ligne: true,
            arret: true,
          }),
        }),
      ]);
      setLignes(lignesResult?.status.success ? lignesResult.data.data : []);
      setArrets(arretsResult?.status.success ? arretsResult.data.data : []);
      setAbonnements(
        abonnementsResult?.status.success ? abonnementsResult.data.data : [],
      );
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

  const stopsByLine = useMemo(() => {
    const grouped = new Map<string, ArretTransport[]>();
    for (const item of arrets) {
      const current = grouped.get(item.ligne_transport_id) ?? [];
      current.push(item);
      grouped.set(item.ligne_transport_id, current);
    }
    return grouped;
  }, [arrets]);

  const openChangeLine = (item: AbonnementTransportWithRelations) => {
    setEditingSubscriptionId(item.id);
    setChangeLineState({
      ligne_transport_id: item.ligne_transport_id,
      arret_transport_id: item.arret_transport_id ?? "",
      date_effet: getTodayInputValue(),
      facturer_regularisation: Boolean(item.facture_id),
    });
  };

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
            <h3 className="text-lg font-semibold text-slate-900">Liste transport</h3>
            <p className="mt-1 text-sm text-slate-500">
              Chaque liste est separee pour simplifier la lecture et les suppressions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Actualisation..." : "Actualiser"}
          </button>
        </div>

        <div className="mt-5">
          <ModeSelector value={mode} onChange={setMode} />
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Spin label="Chargement de la liste transport..." showLabel />
          </div>
        ) : null}
      </section>

      {mode === "lines" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Lignes de transport</h3>
          <div className="mt-4 space-y-3">
            {lignes.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
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
                      await new LigneTransportService().delete(item.id);
                      info("Ligne supprimee.", "success");
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
            ))}
          </div>
        </section>
      ) : null}

      {mode === "stops" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Arrets de transport</h3>
          <div className="mt-4 space-y-3">
            {arrets.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.nom}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.ligne?.nom ?? "Sans ligne"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setBusyId(item.id);
                      await new ArretTransportService().delete(item.id);
                      info("Arret supprime.", "success");
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
            ))}
          </div>
        </section>
      ) : null}

      {mode === "subscriptions" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Abonnements transport</h3>
          <div className="mt-4 space-y-3">
            {abonnements.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.eleve?.utilisateur?.profil?.prenom}{" "}
                      {item.eleve?.utilisateur?.profil?.nom}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.ligne?.nom}
                      {item.arret?.nom ? ` - ${item.arret.nom}` : ""} -{" "}
                      {item.annee?.nom ?? "Annee"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Statut service: {getServiceStatusLabel(item.statut)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Debut: {formatDate(item.date_debut_service)} - Fin: {formatDate(item.date_fin_service)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getAbonnementTransportProrataLabel(item)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.facture?.numero_facture
                        ? `Finance: ${item.facture.numero_facture} - ${item.facture.statut ?? "EMISE"}`
                        : "Finance: en attente de rattachement"}
                    </p>
                    {["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"].includes(
                      (item.statut ?? "").toUpperCase(),
                    ) ? (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Le service reste en attente tant que Finance n'a pas confirme la situation financiere.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openChangeLine(item)}
                      disabled={busyId === item.id}
                      className="rounded-2xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {editingSubscriptionId === item.id ? "Edition ouverte" : "Changer circuit"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setBusyId(item.id);
                          await new AbonnementTransportService().delete(item.id);
                          info(
                            item.facture_id ? "Abonnement transport resilie et regularise." : "Abonnement transport supprime.",
                            "success",
                          );
                          if (editingSubscriptionId === item.id) {
                            setEditingSubscriptionId(null);
                          }
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

                {editingSubscriptionId === item.id ? (
                  <div className="mt-4 grid gap-4 rounded-[20px] border border-sky-200 bg-white px-4 py-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <p className="text-sm font-semibold text-slate-900">Changer de circuit</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Le prorata de regularisation sera calcule a partir de la date d'effet.
                      </p>
                    </div>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Nouvelle ligne</span>
                      <select
                        value={changeLineState.ligne_transport_id}
                        onChange={(event) =>
                          setChangeLineState((current) => ({
                            ...current,
                            ligne_transport_id: event.target.value,
                            arret_transport_id: "",
                          }))
                        }
                        disabled={busyId === item.id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      >
                        <option value="">Selectionner une ligne</option>
                        {lignes.map((ligne) => (
                          <option key={ligne.id} value={ligne.id}>
                            {ligne.nom}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Nouvel arret</span>
                      <select
                        value={changeLineState.arret_transport_id}
                        onChange={(event) =>
                          setChangeLineState((current) => ({
                            ...current,
                            arret_transport_id: event.target.value,
                          }))
                        }
                        disabled={busyId === item.id || !changeLineState.ligne_transport_id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      >
                        <option value="">Sans arret</option>
                        {(stopsByLine.get(changeLineState.ligne_transport_id) ?? []).map((stop) => (
                          <option key={stop.id} value={stop.id}>
                            {stop.nom}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Date d'effet</span>
                      <input
                        type="date"
                        value={changeLineState.date_effet}
                        onChange={(event) =>
                          setChangeLineState((current) => ({
                            ...current,
                            date_effet: event.target.value,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      />
                    </label>

                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={changeLineState.facturer_regularisation}
                        onChange={(event) =>
                          setChangeLineState((current) => ({
                            ...current,
                            facturer_regularisation: event.target.checked,
                          }))
                        }
                        disabled={busyId === item.id || !item.facture_id}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span>
                        Regulariser la facturation
                        <span className="mt-1 block text-xs text-slate-500">
                          {item.facture_id
                            ? "Annule l'ancienne facture transport et cree la nouvelle regularisation au prorata."
                            : "Aucune facture liee a regulariser pour cet abonnement."}
                        </span>
                      </span>
                    </label>

                    <div className="md:col-span-2 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingSubscriptionId(null)}
                        disabled={busyId === item.id}
                        className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (!changeLineState.ligne_transport_id) {
                              throw new Error("La nouvelle ligne de transport est obligatoire.");
                            }
                            if (!changeLineState.date_effet) {
                              throw new Error("La date d'effet est obligatoire.");
                            }
                            setBusyId(item.id);
                            await new AbonnementTransportService().changeLine(item.id, {
                              ligne_transport_id: changeLineState.ligne_transport_id,
                              arret_transport_id: changeLineState.arret_transport_id || null,
                              date_effet: changeLineState.date_effet,
                              facturer_regularisation:
                                item.facture_id ? changeLineState.facturer_regularisation : false,
                            });
                            info("Circuit transport mis a jour.", "success");
                            setEditingSubscriptionId(null);
                            await load();
                          } catch (error) {
                            info(getErrorMessage(error), "error");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === item.id}
                        className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === item.id ? "Mise a jour..." : "Valider le changement"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
