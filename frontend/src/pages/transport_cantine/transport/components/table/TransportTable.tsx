import { useEffect, useState } from "react";
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
  type AbonnementTransportWithRelations,
} from "../../../../../services/abonnementTransport.service";
import type { ArretTransport, LigneTransport } from "../../../../../types/models";

type TransportListMode = "lines" | "stops" | "subscriptions";

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
                      const nextStatus = (item.statut ?? "ACTIF").toUpperCase() === "SUSPENDU" ? "ACTIF" : "SUSPENDU";
                      await new AbonnementTransportService().update(item.id, { statut: nextStatus });
                      info(
                        nextStatus === "SUSPENDU" ? "Service transport suspendu." : "Service transport reactive.",
                        "success",
                      );
                      await load();
                    } catch (error) {
                      info(getErrorMessage(error), "error");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  disabled={busyId === item.id || (item.statut ?? "ACTIF").toUpperCase() === "RESILIE"}
                  className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === item.id
                    ? "Traitement..."
                    : (item.statut ?? "ACTIF").toUpperCase() === "SUSPENDU"
                      ? "Reactiver"
                      : "Suspendre"}
                </button>
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
                className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
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
                    Statut service: {item.statut ?? "ACTIF"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.facture?.numero_facture
                      ? `Finance: ${item.facture.numero_facture} - ${item.facture.statut ?? "EMISE"}`
                      : "Finance: service non facture"}
                  </p>
                </div>
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
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
