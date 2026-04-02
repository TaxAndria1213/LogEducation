import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiMapPin, FiTruck, FiUsers } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import LigneTransportService, {
  getLigneTransportSettings,
} from "../../../../../services/ligneTransport.service";
import ArretTransportService from "../../../../../services/arretTransport.service";
import AbonnementTransportService, {
  getAbonnementTransportDisplayLabel,
  getAbonnementTransportProrataLabel,
  type AbonnementTransportWithRelations,
  type TransportControlAnomalyRow,
} from "../../../../../services/abonnementTransport.service";
import {
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";
import type { ArretTransport, LigneTransport } from "../../../../../types/models";

type Props = { mode?: "overview" | "settings" };

function extractCollectionRows<T>(payload: unknown): T[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data as T[];
  if (
    record.data &&
    typeof record.data === "object" &&
    Array.isArray((record.data as Record<string, unknown>).data)
  ) {
    return (record.data as Record<string, unknown>).data as T[];
  }
  return [];
}

function extractCollectionMeta(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const candidate =
    record.meta && typeof record.meta === "object"
      ? (record.meta as Record<string, unknown>)
      : record.data && typeof record.data === "object"
        ? ((record.data as Record<string, unknown>).meta as Record<string, unknown> | undefined)
        : undefined;

  if (!candidate) return null;
  return {
    page: typeof candidate.page === "number" ? candidate.page : 1,
    totalPages:
      typeof candidate.totalPages === "number"
        ? candidate.totalPages
        : typeof candidate.total_pages === "number"
          ? candidate.total_pages
          : 1,
  };
}

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
  return "Impossible de charger le module transport.";
}

function getAnomalyTone(code: TransportControlAnomalyRow["code"]) {
  switch (code) {
    case "TRANSPORTE_SANS_DROIT_FINANCIER":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900";
    case "PAYE_SANS_AFFECTATION_TRANSPORT":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "SUSPENDU_AVEC_USAGE_REEL":
    default:
      return "border-rose-200 bg-rose-50 text-rose-900";
  }
}

function getAnomalyLabel(code: TransportControlAnomalyRow["code"]) {
  switch (code) {
    case "TRANSPORTE_SANS_DROIT_FINANCIER":
      return "Transporte sans droit financier";
    case "PAYE_SANS_AFFECTATION_TRANSPORT":
      return "Paye sans affectation";
    case "SUSPENDU_AVEC_USAGE_REEL":
    default:
      return "Suspendu avec usage reel";
  }
}

function getTrackingTone(status: TransportControlAnomalyRow["tracking_status"]) {
  switch (status) {
    case "RESOLUE":
      return "bg-emerald-100 text-emerald-800";
    case "IGNOREE":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-white/70 text-slate-800";
  }
}

function getTrackingLabel(status: TransportControlAnomalyRow["tracking_status"]) {
  switch (status) {
    case "RESOLUE":
      return "Resolue";
    case "IGNOREE":
      return "Ignoree";
    default:
      return "Ouverte";
  }
}

export default function TransportOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [lignes, setLignes] = useState<LigneTransport[]>([]);
  const [arrets, setArrets] = useState<ArretTransport[]>([]);
  const [abonnements, setAbonnements] = useState<AbonnementTransportWithRelations[]>([]);
  const [controlAnomalies, setControlAnomalies] = useState<TransportControlAnomalyRow[]>([]);
  const [controlSummary, setControlSummary] = useState({
    total: 0,
    transportes_sans_droit_financier: 0,
    payes_sans_affectation_transport: 0,
    suspendus_encore_planifies: 0,
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAnomalyId, setBusyAnomalyId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!etablissement_id) return;
      if (active) setLoading(true);
      try {
        const abonnementService = new AbonnementTransportService();
        const [lignesResult, arretsResult, anomaliesResult] = await Promise.all([
          new LigneTransportService().getForEtablissement(etablissement_id, {
            take: 300,
            includeSpec: JSON.stringify({ arrets: true, frais: true }),
          }),
          new ArretTransportService().getForEtablissement(etablissement_id, {
            take: 500,
            includeSpec: JSON.stringify({ ligne: true }),
          }),
          abonnementService.getControlAnomalies(etablissement_id),
        ]);

        const abonnementRows: AbonnementTransportWithRelations[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const abonnementsResult = await abonnementService.getForEtablissement(etablissement_id, {
            page,
            take: 500,
            includeSpec: JSON.stringify({
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              ligne: true,
              arret: true,
            }),
          });
          if (abonnementsResult?.status.success) {
            const rows = extractCollectionRows<AbonnementTransportWithRelations>(
              abonnementsResult.data,
            );
            abonnementRows.push(...rows);
            const meta = extractCollectionMeta(abonnementsResult.data);
            totalPages = meta?.totalPages ?? 1;
            page = (meta?.page ?? page) + 1;
          } else {
            break;
          }
        } while (page <= totalPages);

        if (!active) return;
        setLignes(lignesResult?.status.success ? lignesResult.data.data : []);
        setArrets(arretsResult?.status.success ? arretsResult.data.data : []);
        setAbonnements(abonnementRows);
        const anomaliesPayload =
          anomaliesResult?.status.success && anomaliesResult.data?.data
            ? (anomaliesResult.data.data as {
                rows?: TransportControlAnomalyRow[];
                summary?: {
                  total?: number;
                  transportes_sans_droit_financier?: number;
                  payes_sans_affectation_transport?: number;
                  suspendus_encore_planifies?: number;
                };
              })
            : {};
        setControlAnomalies(Array.isArray(anomaliesPayload.rows) ? anomaliesPayload.rows : []);
        setControlSummary({
          total: anomaliesPayload.summary?.total ?? 0,
          transportes_sans_droit_financier:
            anomaliesPayload.summary?.transportes_sans_droit_financier ?? 0,
          payes_sans_affectation_transport:
            anomaliesPayload.summary?.payes_sans_affectation_transport ?? 0,
          suspendus_encore_planifies:
            anomaliesPayload.summary?.suspendus_encore_planifies ?? 0,
        });
        setErrorMessage("");
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [etablissement_id, reloadToken]);

  const refreshDashboard = () => {
    setReloadToken((value) => value + 1);
  };

  const handleMarkAnomaly = async (
    anomaly: TransportControlAnomalyRow,
    decision: "RESOLVED" | "IGNORED",
  ) => {
    if (!etablissement_id) return;
    setBusyAnomalyId(anomaly.anomaly_id);
    try {
      await new AbonnementTransportService().markControlAnomaly(etablissement_id, {
        anomaly_id: anomaly.anomaly_id,
        decision,
      });
      setErrorMessage("");
      refreshDashboard();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAnomalyId(null);
    }
  };

  const handleSuspendFromAnomaly = async (anomaly: TransportControlAnomalyRow) => {
    if (!anomaly.abonnement_transport_id) return;
    setBusyAnomalyId(anomaly.anomaly_id);
    try {
      await new AbonnementTransportService().signalFinanceSuspension(
        anomaly.abonnement_transport_id,
        {
          source: "CONTROLE_TRANSPORT_FINANCE",
          motif: "Anomalie de controle: eleve transporte sans droit financier actif.",
        },
      );
      setErrorMessage("");
      refreshDashboard();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAnomalyId(null);
    }
  };

  const activeSubscriptions = useMemo(
    () => abonnements.filter((item) => (item.statut ?? "ACTIF").toUpperCase() === "ACTIF").length,
    [abonnements],
  );
  const pendingFinance = useMemo(
    () =>
      abonnements.filter((item) =>
        ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"].includes(
          (item.statut ?? "").toUpperCase(),
        ),
      ).length,
    [abonnements],
  );
  const pendingInternal = useMemo(
    () =>
      abonnements.filter(
        (item) => (item.statut ?? "").toUpperCase() === "EN_ATTENTE_VALIDATION_INTERNE",
      ).length,
    [abonnements],
  );

  const activeWithoutFacture = useMemo(
    () =>
      abonnements.filter(
        (item) => (item.finance_status ?? "").toUpperCase() === "A_FACTURER",
      ),
    [abonnements],
  );

  const suspendedWithFacture = useMemo(
    () =>
      abonnements.filter(
        (item) => (item.statut ?? "ACTIF").toUpperCase() === "SUSPENDU" && Boolean(item.facture_id),
      ),
    [abonnements],
  );

  const prorataSubscriptions = useMemo(
    () =>
      abonnements.filter((item) => {
        const ratio =
          typeof item.prorata_ratio === "number"
            ? item.prorata_ratio
            : Number(item.prorata_ratio ?? 0);
        return Number.isFinite(ratio) && ratio > 0 && ratio < 1;
      }),
    [abonnements],
  );

  const lineControlRows = useMemo(
    () =>
      lignes
        .map((line) => {
          const lineSubscriptions = abonnements.filter((item) => item.ligne_transport_id === line.id);
          const activeCount = lineSubscriptions.filter(
            (item) => (item.statut ?? "ACTIF").toUpperCase() === "ACTIF",
          ).length;
          const billedCount = lineSubscriptions.filter((item) => Boolean(item.facture_id)).length;
          return {
            id: line.id,
            nom: line.nom,
            activeCount,
            billedCount,
            gap: activeCount - billedCount,
          };
        })
        .sort((a, b) => b.gap - a.gap || b.activeCount - a.activeCount)
        .slice(0, 6),
    [abonnements, lignes],
  );

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Spin label="Chargement des donnees transport..." showLabel />
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiTruck />
            <span className="text-sm font-medium">Lignes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{lignes.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiMapPin />
            <span className="text-sm font-medium">Arrets</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{arrets.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Abonnements</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{abonnements.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Actifs</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{activeSubscriptions}</p>
          <p className="mt-2 text-xs text-slate-500">
            {pendingInternal} attente interne - {pendingFinance} attente Finance
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-3 text-amber-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">A facturer</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-amber-950">{activeWithoutFacture.length}</p>
          <p className="mt-2 text-xs text-amber-800">
            Demandes validees cote transport mais pas encore prises en charge par Finance.
          </p>
        </div>

        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-center gap-3 text-rose-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">Suspendus avec facture</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-rose-950">{suspendedWithFacture.length}</p>
          <p className="mt-2 text-xs text-rose-800">
            Services bloques ayant encore un suivi financier actif.
          </p>
        </div>

        <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-5">
          <div className="flex items-center gap-3 text-sky-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">Prorata appliques</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-sky-950">{prorataSubscriptions.length}</p>
          <p className="mt-2 text-xs text-sky-800">
            Abonnements demarres ou arretes en cours de mois.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-fuchsia-200 bg-fuchsia-50 p-5">
          <div className="flex items-center gap-3 text-fuchsia-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">Anomalies controle</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-fuchsia-950">{controlSummary.total}</p>
          <p className="mt-2 text-xs text-fuchsia-800">
            Rapprochement actif entre service transporte et situation Finance.
          </p>
        </div>
        <div className="rounded-[24px] border border-fuchsia-200 bg-fuchsia-50 p-5">
          <div className="flex items-center gap-3 text-fuchsia-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">Sans droit financier</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-fuchsia-950">
            {controlSummary.transportes_sans_droit_financier}
          </p>
          <p className="mt-2 text-xs text-fuchsia-800">
            Eleves encore exploites alors que le feu vert financier manque.
          </p>
        </div>
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-3 text-amber-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">Payes non affectes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-amber-950">
            {controlSummary.payes_sans_affectation_transport}
          </p>
          <p className="mt-2 text-xs text-amber-800">
            Reglements transport identifies sans affectation exploitable cote transport.
          </p>
        </div>
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-center gap-3 text-rose-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">Suspendus utilises</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-rose-950">
            {controlSummary.suspendus_encore_planifies}
          </p>
          <p className="mt-2 text-xs text-rose-800">
            Eleves suspendus pour lesquels un passage reel a ete enregistre.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr,1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Lignes recentes</h3>
          <div className="mt-5 space-y-3">
            {lignes.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-slate-900">{item.nom}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.frais
                    ? `${item.frais.nom} - ${getCatalogueFraisSecondaryLabel(item.frais as CatalogueFraisWithRelations)}`
                    : "Aucun frais catalogue relie"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Zones: {getLigneTransportSettings(item).zones.join(", ") || "Aucune zone"}
                </p>
              </div>
            ))}
            {lignes.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune ligne enregistree.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          {mode === "settings" ? null : (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Abonnements recents</h3>
              <div className="mt-5 space-y-3">
                {abonnements.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {item.eleve?.utilisateur?.profil?.prenom} {item.eleve?.utilisateur?.profil?.nom}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.ligne?.nom} {item.arret?.nom ? `- ${item.arret.nom}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getAbonnementTransportProrataLabel(item)}
                    </p>
                  </div>
                ))}
                {abonnements.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun abonnement enregistre.</p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr,1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Controle par ligne</h3>
          <div className="mt-5 space-y-3">
            {lineControlRows.map((row) => (
              <div
                key={row.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{row.nom}</p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      row.gap > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {row.gap > 0 ? `${row.gap} a verifier` : "Aligne"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Actifs: {row.activeCount} - Factures rattachees: {row.billedCount}
                </p>
              </div>
            ))}
            {lineControlRows.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune ligne a controler.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Alertes transport</h3>
          <div className="mt-5 space-y-3">
            {activeWithoutFacture.slice(0, 4).map((item) => (
              <div
                key={`unbilled-${item.id}`}
                className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-amber-950">
                  {getAbonnementTransportDisplayLabel(item)}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Abonnement valide cote transport mais encore a facturer sur {item.ligne?.nom ?? "une ligne"}.
                </p>
              </div>
            ))}

            {prorataSubscriptions.slice(0, 3).map((item) => (
              <div
                key={`prorata-${item.id}`}
                className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-sky-950">
                  {getAbonnementTransportDisplayLabel(item)}
                </p>
                <p className="mt-1 text-xs text-sky-800">
                  {getAbonnementTransportProrataLabel(item)} sur {item.ligne?.nom ?? "la ligne transport"}.
                </p>
              </div>
            ))}

            {suspendedWithFacture.slice(0, 3).map((item) => (
              <div
                key={`suspended-${item.id}`}
                className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-rose-950">
                  {getAbonnementTransportDisplayLabel(item)}
                </p>
                <p className="mt-1 text-xs text-rose-800">
                  Service suspendu avec suivi financier encore actif.
                </p>
              </div>
            ))}

            {activeWithoutFacture.length === 0 &&
            prorataSubscriptions.length === 0 &&
            suspendedWithFacture.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucune anomalie de transport evidente sur les abonnements actuels.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Anomalies Transport vs Finance</h3>
            <p className="mt-1 text-sm text-slate-500">
              Rapprochement des eleves transportes, des reglements Finance et des situations suspendues.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {controlSummary.total} a corriger
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {controlAnomalies.slice(0, 8).map((item, index) => (
            <div
              key={`${item.code}-${item.eleve_id ?? item.facture_id ?? index}`}
              className={`rounded-[22px] border px-4 py-4 ${getAnomalyTone(item.code)}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{item.eleve_label}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                    {getAnomalyLabel(item.code)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold">
                    {item.code_eleve ?? "Sans code"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTrackingTone(item.tracking_status)}`}
                  >
                    {getTrackingLabel(item.tracking_status)}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm">{item.motif}</p>
              <p className="mt-2 text-xs opacity-80">
                {item.ligne_label ? `Ligne ${item.ligne_label}` : "Aucune ligne transport active"}{" "}
                {item.arret_label ? `- ${item.arret_label}` : ""}
                {item.facture_numero ? ` - Facture ${item.facture_numero}` : ""}
              </p>
              <p className="mt-1 text-xs opacity-80">
                Service: {item.service_status ?? "N/A"} - Finance: {item.finance_status ?? "N/A"} - Etat
                exploitation: {item.operational_status ?? "N/A"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.code === "TRANSPORTE_SANS_DROIT_FINANCIER" && item.abonnement_transport_id ? (
                  <button
                    type="button"
                    onClick={() => void handleSuspendFromAnomaly(item)}
                    disabled={busyAnomalyId === item.anomaly_id}
                    className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAnomalyId === item.anomaly_id ? "Traitement..." : "Suspendre le service"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleMarkAnomaly(item, "RESOLVED")}
                  disabled={busyAnomalyId === item.anomaly_id}
                  className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAnomalyId === item.anomaly_id ? "Traitement..." : "Marquer resolue"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleMarkAnomaly(item, "IGNORED")}
                  disabled={busyAnomalyId === item.anomaly_id}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAnomalyId === item.anomaly_id ? "Traitement..." : "Ignorer"}
                </button>
              </div>
            </div>
          ))}

          {controlAnomalies.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-emerald-300 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              Aucune anomalie de rapprochement detectee entre le service transport et la situation Finance.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
