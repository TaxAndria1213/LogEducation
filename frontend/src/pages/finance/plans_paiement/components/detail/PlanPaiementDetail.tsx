import { useEffect, useState } from "react";
import {
  FiBell,
  FiCalendar,
  FiCreditCard,
  FiDownload,
  FiEdit3,
  FiFileText,
  FiList,
  FiPrinter,
  FiUser,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useInfo } from "../../../../../hooks/useInfo";
import FinanceRelanceService, {
  type FinanceRelanceHistoryItem,
} from "../../../../../services/financeRelance.service";
import PlanPaiementEleveService, {
  getPlanPaiementDisplayLabel,
  getPlanPaiementEcheances,
  getPlanPaiementPaidAmount,
  getPlanPaiementRescheduleWorkflow,
  getPlanPaiementRemainingAmount,
  getPlanPaiementSecondaryLabel,
  getPlanPaiementTotalAmount,
} from "../../../../../services/planPaiementEleve.service";
import { usePlanPaiementStore } from "../../store/PlanPaiementIndexStore";
import {
  getFinanceModulePath,
  queueFinanceNavigationTarget,
} from "../../../../finance/utils/crossNavigation";
import {
  buildPlanPaiementPdf,
  downloadPdf,
  previewPdf,
} from "../../../../finance/utils/financePdf";

function formatMoney(value: number, devise = "MGA") {
  return `${Number(value ?? 0).toLocaleString("fr-FR")} ${devise}`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Non renseignee";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseignee";
  return date.toLocaleDateString("fr-FR");
}

function getStatusLabel(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "A_VENIR":
      return "A venir";
    case "PARTIELLE":
      return "Partielle";
    case "PAYEE":
      return "Payee";
    case "ANNULEE":
      return "Annulee";
    case "EN_RETARD":
      return "En retard";
    default:
      return status ?? "Statut";
  }
}

function getApiErrorMessage(error: unknown) {
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
  return "Impossible de traiter la relance financiere.";
}

export default function PlanPaiementDetail() {
  const plan = usePlanPaiementStore((state) => state.selectedPlanPaiement);
  const setRenderedComponent = usePlanPaiementStore((state) => state.setRenderedComponent);
  const navigate = useNavigate();
  const { info } = useInfo();
  const [relances, setRelances] = useState<FinanceRelanceHistoryItem[]>([]);
  const [processingReschedule, setProcessingReschedule] = useState(false);
  const [loadingRelances, setLoadingRelances] = useState(false);
  const [sendingRelance, setSendingRelance] = useState(false);

  useEffect(() => {
    let active = true;

    const loadRelances = async () => {
      if (!plan?.id) return;
      setLoadingRelances(true);

      try {
        const service = new FinanceRelanceService();
        const result = await service.getHistory({
          plan_paiement_id: plan.id,
          take: 20,
        });

        if (!active) return;
        setRelances(Array.isArray(result.data) ? (result.data as FinanceRelanceHistoryItem[]) : []);
      } catch {
        if (!active) return;
        setRelances([]);
      } finally {
        if (active) setLoadingRelances(false);
      }
    };

    void loadRelances();

    return () => {
      active = false;
    };
  }, [plan?.id]);

  if (!plan) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Plan indisponible</h3>
        <p className="mt-2 text-sm text-slate-500">
          Selectionne un plan de paiement depuis la liste pour afficher ses details.
        </p>
      </div>
    );
  }

  const service = new PlanPaiementEleveService();
  const workflow = getPlanPaiementRescheduleWorkflow(plan);
  const workflowStatus = String(workflow?.statut ?? "").toUpperCase();
  const devise = plan.plan_json?.devise ?? "MGA";
  const echeances = getPlanPaiementEcheances(plan);
  const lockedInstallments = echeances.filter(
    (item) =>
      Number(item.paid_amount ?? 0) > 0 ||
      ["PAYEE", "PARTIELLE"].includes((item.statut ?? "").toUpperCase()),
  );
  const editableInstallments = Math.max(0, echeances.length - lockedInstallments.length);
  const linkedFactureIds = Array.from(
    new Set(echeances.map((item) => item.facture_id).filter(Boolean)),
  ) as string[];
  const openInstallments = echeances.filter((item) => {
    const remaining = Number(item.remaining_amount ?? item.montant ?? 0);
    const status = (item.statut ?? "").toUpperCase();
    return remaining > 0 && status !== "PAYEE" && status !== "ANNULEE";
  });

  const openFacture = (factureId: string) => {
    queueFinanceNavigationTarget({
      module: "factures",
      id: factureId,
      view: "detail",
    });
    navigate(getFinanceModulePath("factures"));
  };

  const handleDownloadPdf = () => {
    const { doc, filename } = buildPlanPaiementPdf(plan);
    downloadPdf(doc, filename);
    info("Le PDF du plan de paiement a ete genere.", "success");
  };

  const handlePrint = () => {
    const { doc, filename } = buildPlanPaiementPdf(plan);
    const opened = previewPdf(doc, true);
    if (!opened) {
      downloadPdf(doc, filename);
      info("Le navigateur a bloque l'aperÃ§u d'impression. Le PDF du plan a ete telecharge.", "warning");
      return;
    }
    info("AperÃ§u d'impression ouvert pour le plan de paiement.", "info");
  };

  const handleApproveReschedule = async () => {
    if (!plan?.id) return;
    try {
      setProcessingReschedule(true);
      await service.approveReschedule(plan.id);
      info("Le reechelonnement a ete approuve et applique.", "success");
      window.location.reload();
    } catch (error) {
      info(getApiErrorMessage(error), "error");
    } finally {
      setProcessingReschedule(false);
    }
  };

  const handleRejectReschedule = async () => {
    if (!plan?.id) return;
    const motif = window.prompt("Motif du rejet", "") ?? "";
    try {
      setProcessingReschedule(true);
      await service.rejectReschedule(plan.id, motif);
      info("La demande de reechelonnement a ete rejetee.", "success");
      window.location.reload();
    } catch (error) {
      info(getApiErrorMessage(error), "error");
    } finally {
      setProcessingReschedule(false);
    }
  };

  const handleSendRelance = async () => {
    if (openInstallments.length === 0) return;

    try {
      setSendingRelance(true);
      const service = new FinanceRelanceService();
      const result = await service.sendRelance({
        plan_paiement_id: plan.id,
      });
      const sent = Array.isArray(result.data?.sent) ? (result.data.sent as FinanceRelanceHistoryItem[]) : [];

      if (sent.length > 0) {
        setRelances((current) => {
          const deduped = new Map([...sent, ...current].map((item) => [item.id, item]));
          return [...deduped.values()];
        });
      }

      info("La relance financiere a ete envoyee depuis le plan de paiement.", "success");
    } catch (error) {
      info(getApiErrorMessage(error), "error");
    } finally {
      setSendingRelance(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-slate-900">{getPlanPaiementDisplayLabel(plan)}</h2>
            <p className="mt-2 text-sm text-slate-500">{getPlanPaiementSecondaryLabel(plan)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRenderedComponent("list")}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <FiList />
              Retour liste
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <FiDownload />
              PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <FiPrinter />
              Imprimer
            </button>
            <button
              type="button"
              onClick={() => setRenderedComponent("edit")}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <FiEdit3 />
              {lockedInstallments.length > 0 ? "Reechelonner" : "Modifier"}
            </button>
            {workflowStatus === "EN_ATTENTE" ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleApproveReschedule()}
                  disabled={processingReschedule}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processingReschedule ? "Traitement..." : "Approuver le reechelonnement"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRejectReschedule()}
                  disabled={processingReschedule}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Rejeter la demande
                </button>
              </>
            ) : null}
            {openInstallments.length > 0 ? (
              <button
                type="button"
                onClick={() => void handleSendRelance()}
                disabled={sendingRelance}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiBell />
                {sendingRelance ? "Envoi..." : "Relancer les echeances ouvertes"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiFileText />
            <span className="text-sm font-medium">Montant prevu</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatMoney(getPlanPaiementTotalAmount(plan), devise)}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCreditCard />
            <span className="text-sm font-medium">Montant regle</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatMoney(getPlanPaiementPaidAmount(plan), devise)}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCalendar />
            <span className="text-sm font-medium">Reste a regler</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatMoney(getPlanPaiementRemainingAmount(plan), devise)}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUser />
            <span className="text-sm font-medium">Mode</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {plan.plan_json?.mode_paiement ?? "Non renseigne"}
          </p>
        </div>
      </section>

      {workflow ? (
        <section className="rounded-[28px] border border-sky-200 bg-sky-50 px-6 py-5 shadow-sm">
          <h3 className="text-lg font-semibold text-sky-950">Workflow de reechelonnement</h3>
          <p className="mt-2 text-sm leading-6 text-sky-900">
            Statut : {workflow.statut ?? "NON_DEFINI"}
            {workflow.motif ? ` · Motif : ${String(workflow.motif)}` : ""}
            {workflow.motif_rejet ? ` · Rejet : ${String(workflow.motif_rejet)}` : ""}
          </p>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-5 shadow-sm">
        <h3 className="text-lg font-semibold text-amber-950">Reechelonnement controle</h3>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Les tranches deja reglees ou partiellement reglees restent verrouillees. Seules les echeances
          futures non encaissees peuvent etre reajustees dans l'edition du plan.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-amber-950">
          <span className="rounded-full bg-white/80 px-3 py-1 font-semibold">
            {lockedInstallments.length} tranche(s) verrouillee(s)
          </span>
          <span className="rounded-full bg-white/80 px-3 py-1 font-semibold">
            {editableInstallments} tranche(s) ajustable(s)
          </span>
          <span className="rounded-full bg-white/80 px-3 py-1 font-semibold">
            {linkedFactureIds.length} facture(s) liee(s)
          </span>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Echeancier detaille</h3>
          <div className="mt-5 space-y-3">
            {echeances.map((echeance, index) => (
              <div
                key={echeance.id ?? `${echeance.date}-${index}`}
                className={`rounded-[22px] border px-4 py-4 ${
                  Number(echeance.paid_amount ?? 0) > 0 ||
                  ["PAYEE", "PARTIELLE"].includes((echeance.statut ?? "").toUpperCase())
                    ? "border-amber-200 bg-amber-50/70"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {echeance.libelle?.trim() || `Tranche ${echeance.ordre ?? index + 1}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(echeance.date)} - {getStatusLabel(echeance.statut)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                      <span
                        className={`rounded-full px-2.5 py-1 ${
                          Number(echeance.paid_amount ?? 0) > 0 ||
                          ["PAYEE", "PARTIELLE"].includes((echeance.statut ?? "").toUpperCase())
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {Number(echeance.paid_amount ?? 0) > 0 ||
                        ["PAYEE", "PARTIELLE"].includes((echeance.statut ?? "").toUpperCase())
                          ? "Verrouillee"
                          : "Ajustable"}
                      </span>
                      {echeance.facture_id ? (
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">
                          Facture liee
                        </span>
                      ) : null}
                    </div>
                    {echeance.note ? <p className="mt-2 text-xs text-slate-500">{echeance.note}</p> : null}
                    {echeance.facture_id ? (
                      <button
                        type="button"
                        onClick={() => openFacture(echeance.facture_id as string)}
                        className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        Ouvrir la facture
                      </button>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatMoney(echeance.montant, echeance.devise ?? devise)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Regle {formatMoney(Number(echeance.paid_amount ?? 0), echeance.devise ?? devise)} - Reste{" "}
                      {formatMoney(Number(echeance.remaining_amount ?? 0), echeance.devise ?? devise)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {echeances.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune echeance definie.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Informations</h3>
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <FiUser className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Eleve</p>
                  <p className="mt-1 text-sm text-slate-900">{getPlanPaiementSecondaryLabel(plan)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiCalendar className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Tranches</p>
                  <p className="mt-1 text-sm text-slate-900">{echeances.length}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiFileText className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Notes</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {plan.plan_json?.notes?.trim() || "Aucune note"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiCreditCard className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Remise</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {plan.remise
                      ? `${plan.remise.nom} (${plan.remise.type?.toUpperCase() === "PERCENT" ? `${Number(plan.remise.valeur ?? 0)}%` : Number(plan.remise.valeur ?? 0).toLocaleString("fr-FR")})`
                      : "Aucune remise"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Relances envoyees</h3>
            <div className="mt-5 space-y-3">
              {relances.map((relance) => (
                <div key={relance.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {relance.objet.replace(/^\[FINANCE_RELANCE\]\[[^\]]+\]\s*/, "")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {relance.destinataires.map((destinataire) => destinataire.nom).join(", ") || "Aucun destinataire"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatDate(relance.envoye_le)}</p>
                      <p className="mt-1 text-xs text-slate-500">{relance.echeance_ids.length} echeance(s)</p>
                    </div>
                  </div>
                </div>
              ))}
              {!loadingRelances && relances.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune relance envoyee pour ce plan.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Facturation liee</h3>
            <div className="mt-5 space-y-3">
              {linkedFactureIds.map((factureId) => (
                <div key={factureId} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">Facture liee</p>
                  <p className="mt-1 text-xs text-slate-500">{factureId}</p>
                  <button
                    type="button"
                    onClick={() => openFacture(factureId)}
                    className="mt-3 inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    Ouvrir la facture
                  </button>
                </div>
              ))}
              {linkedFactureIds.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune facture liee a ce plan pour le moment.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}




