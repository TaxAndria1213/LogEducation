import { useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiCreditCard,
  FiDownload,
  FiFileText,
  FiList,
  FiPrinter,
  FiRefreshCcw,
  FiSlash,
  FiUser,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useInfo } from "../../../../../hooks/useInfo";
import PaiementService, {
  getPaiementDisplayLabel,
  getPaiementSecondaryLabel,
  getPaiementStatusLabel,
  type PaiementWithRelations,
} from "../../../../../services/paiement.service";
import { getFactureStatusLabel } from "../../../../../services/facture.service";
import { usePaiementStore } from "../../store/PaiementIndexStore";
import {
  getFinanceModulePath,
  queueFinanceNavigationTarget,
} from "../../../../finance/utils/crossNavigation";
import {
  buildPaiementReceiptPdf,
  downloadPdf,
  previewPdf,
} from "../../../../finance/utils/financePdf";

function formatMoney(value: unknown, devise = "MGA") {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;
  return `${(Number.isFinite(amount) ? amount : 0).toLocaleString("fr-FR")} ${devise}`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Non renseignee";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseignee";
  return date.toLocaleDateString("fr-FR");
}

function getAffectationLabel(paiement: PaiementWithRelations, index: number) {
  const affectation = paiement.affectations?.[index];
  if (!affectation?.echeance) return `Affectation ${index + 1}`;
  return affectation.echeance.libelle?.trim() || `Echeance ${affectation.echeance.ordre}`;
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
  return "Operation comptable impossible sur ce paiement.";
}

export default function PaiementDetail() {
  const paiement = usePaiementStore((state) => state.selectedPaiement);
  const setSelectedPaiement = usePaiementStore((state) => state.setSelectedPaiement);
  const setRenderedComponent = usePaiementStore((state) => state.setRenderedComponent);
  const navigate = useNavigate();
  const { info } = useInfo();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const service = useMemo(() => new PaiementService(), []);

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      if (!paiement?.id) return;
      setLoadingDetail(true);

      try {
        const response = await service.get(paiement.id);
        if (!active) return;
        setSelectedPaiement(response.data as PaiementWithRelations);
      } catch {
        // Keep currently selected data if refresh fails.
      } finally {
        if (active) setLoadingDetail(false);
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [paiement?.id, service, setSelectedPaiement]);

  if (!paiement) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Paiement indisponible</h3>
        <p className="mt-2 text-sm text-slate-500">
          Selectionne un paiement depuis la liste pour afficher son detail.
        </p>
      </div>
    );
  }

  const devise = paiement.facture?.devise ?? "MGA";
  const canOperate = (paiement.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE";

  const openFacture = () => {
    if (!paiement.facture?.id) return;
    queueFinanceNavigationTarget({
      module: "factures",
      id: paiement.facture.id,
      record: paiement.facture,
      view: "detail",
    });
    navigate(getFinanceModulePath("factures"));
  };

  const openPlan = (planId: string) => {
    queueFinanceNavigationTarget({
      module: "plans_paiement",
      id: planId,
      view: "detail",
    });
    navigate(getFinanceModulePath("plans_paiement"));
  };

  const handleDownloadPdf = () => {
    const { doc, filename } = buildPaiementReceiptPdf(paiement);
    downloadPdf(doc, filename);
    info("Le recu de paiement a ete genere.", "success");
  };

  const handlePrint = () => {
    const { doc, filename } = buildPaiementReceiptPdf(paiement);
    const opened = previewPdf(doc, true);
    if (!opened) {
      downloadPdf(doc, filename);
      info("Le navigateur a bloque l'aperçu d'impression. Le recu a ete telecharge.", "warning");
      return;
    }
    info("Aperçu d'impression ouvert pour le recu.", "info");
  };

  const refreshPaiement = async () => {
    const response = await service.get(paiement.id);
    setSelectedPaiement(response.data as PaiementWithRelations);
  };

  const handleCancel = async () => {
    const motif = window.prompt("Motif d'annulation du paiement", "") ?? "";

    try {
      setProcessingAction(true);
      await service.cancel(paiement.id, { motif: motif.trim() || null });
      await refreshPaiement();
      info("Le paiement a ete annule.", "success");
    } catch (error) {
      info(getApiErrorMessage(error), "error");
    } finally {
      setProcessingAction(false);
    }
  };

  const handleRefund = async () => {
    const motif = window.prompt("Motif du remboursement", "") ?? "";

    try {
      setProcessingAction(true);
      await service.refund(paiement.id, { motif: motif.trim() || null });
      await refreshPaiement();
      info("Le paiement a ete marque comme rembourse.", "success");
    } catch (error) {
      info(getApiErrorMessage(error), "error");
    } finally {
      setProcessingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-slate-900">{getPaiementDisplayLabel(paiement)}</h2>
            <p className="mt-2 text-sm text-slate-500">{getPaiementSecondaryLabel(paiement)}</p>
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
            {paiement.facture?.id ? (
              <button
                type="button"
                onClick={openFacture}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <FiFileText />
                Ouvrir la facture
              </button>
            ) : null}
            {canOperate ? (
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={processingAction}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSlash />
                Annuler
              </button>
            ) : null}
            {canOperate ? (
              <button
                type="button"
                onClick={() => void handleRefund()}
                disabled={processingAction}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCcw />
                Rembourser
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {loadingDetail ? (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500 shadow-sm">
          Actualisation du paiement...
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCreditCard />
            <span className="text-sm font-medium">Montant paye</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatMoney(paiement.montant, devise)}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCalendar />
            <span className="text-sm font-medium">Date</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatDate(paiement.paye_le)}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiFileText />
            <span className="text-sm font-medium">Facture</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {paiement.facture?.numero_facture ?? "Non renseignee"}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiRefreshCcw />
            <span className="text-sm font-medium">Statut paiement</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {getPaiementStatusLabel(paiement.statut)}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiRefreshCcw />
            <span className="text-sm font-medium">Statut facture</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {getFactureStatusLabel(paiement.facture?.statut)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Echeances reglees par ce paiement</h3>
          <div className="mt-5 space-y-3">
            {paiement.affectations?.map((affectation, index) => (
              <div key={affectation.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {getAffectationLabel(paiement, index)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {affectation.echeance
                        ? `${formatDate(affectation.echeance.date_echeance)} - ${affectation.echeance.statut}`
                        : "Aucune echeance detaillee"}
                    </p>
                    {affectation.echeance?.plan_paiement_id ? (
                      <button
                        type="button"
                        onClick={() => openPlan(affectation.echeance?.plan_paiement_id as string)}
                        className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        Ouvrir le plan
                      </button>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatMoney(affectation.montant, devise)}
                  </p>
                </div>
              </div>
            ))}
            {(paiement.affectations?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">
                Aucune affectation d&apos;echeance detaillee pour ce paiement.
              </p>
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
                  <p className="mt-1 text-sm text-slate-900">
                    {paiement.facture?.eleve?.utilisateur?.profil?.prenom || paiement.facture?.eleve?.utilisateur?.profil?.nom
                      ? `${paiement.facture?.eleve?.utilisateur?.profil?.prenom ?? ""} ${paiement.facture?.eleve?.utilisateur?.profil?.nom ?? ""}`.trim()
                      : paiement.facture?.eleve?.code_eleve ?? "Non renseigne"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiCreditCard className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Methode</p>
                  <p className="mt-1 text-sm text-slate-900">{paiement.methode ?? "Non renseignee"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiFileText className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Reference</p>
                  <p className="mt-1 text-sm text-slate-900">{paiement.reference ?? "Non renseignee"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiRefreshCcw className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Statut comptable</p>
                  <p className="mt-1 text-sm text-slate-900">{getPaiementStatusLabel(paiement.statut)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Historique comptable</h3>
            <div className="mt-5 space-y-3">
              {paiement.operationsFinancieres?.map((operation) => (
                <div key={operation.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{operation.type.replace(/_/g, " ")}</p>
                      <p className="mt-1 text-xs text-slate-500">{operation.motif || "Sans motif"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatMoney(operation.montant ?? 0, devise)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(operation.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(paiement.operationsFinancieres?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">Aucune operation comptable sur ce paiement.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Echeancier restant</h3>
            <div className="mt-5 space-y-3">
              {paiement.facture?.echeances?.map((echeance) => (
                <div key={echeance.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {echeance.libelle?.trim() || `Echeance ${echeance.ordre}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(echeance.date_echeance)} - {echeance.statut}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatMoney(echeance.montant_prevu, echeance.devise ?? devise)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Regle {formatMoney(echeance.montant_regle, echeance.devise ?? devise)} - Reste{" "}
                        {formatMoney(echeance.montant_restant, echeance.devise ?? devise)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {(paiement.facture?.echeances?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">Aucune echeance rattachee a cette facture.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
