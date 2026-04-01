import { useEffect, useMemo, useState } from "react";
import {
  FiBell,
  FiCalendar,
  FiCreditCard,
  FiDownload,
  FiEdit3,
  FiFileText,
  FiLayers,
  FiList,
  FiPrinter,
  FiRefreshCcw,
  FiSlash,
  FiUser,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useInfo } from "../../../../../hooks/useInfo";
import FinanceRelanceService, {
  type FinanceRelanceHistoryItem,
} from "../../../../../services/financeRelance.service";
import FactureService from "../../../../../services/facture.service";
import {
  getFactureDisplayLabel,
  getFactureNatureLabel,
  getFactureSecondaryLabel,
  getFactureStatusLabel,
  type FactureWithRelations,
} from "../../../../../services/facture.service";
import { useFactureStore } from "../../store/FactureIndexStore";
import {
  getFinanceModulePath,
  queueFinanceNavigationTarget,
} from "../../../../finance/utils/crossNavigation";
import {
  buildFacturePdf,
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

export default function FactureDetail() {
  const facture = useFactureStore((state) => state.selectedFacture);
  const setSelectedFacture = useFactureStore((state) => state.setSelectedFacture);
  const setRenderedComponent = useFactureStore((state) => state.setRenderedComponent);
  const navigate = useNavigate();
  const { info } = useInfo();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [relances, setRelances] = useState<FinanceRelanceHistoryItem[]>([]);
  const [loadingRelances, setLoadingRelances] = useState(false);
  const [sendingRelance, setSendingRelance] = useState(false);
  const [processingAccountingAction, setProcessingAccountingAction] = useState(false);
  const service = useMemo(() => new FactureService(), []);

  const openInstallments = useMemo(
    () =>
      (facture?.echeances ?? []).filter((item) => {
        const remaining =
          typeof item.montant_restant === "number"
            ? item.montant_restant
            : Number(item.montant_restant ?? 0);
        const status = (item.statut ?? "").toUpperCase();
        return remaining > 0 && status !== "PAYEE" && status !== "ANNULEE";
      }),
    [facture?.echeances],
  );

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      if (!facture?.id) return;
      setLoadingDetail(true);

      try {
        const response = await service.get(facture.id);
        if (!active) return;
        setSelectedFacture(response.data as FactureWithRelations);
      } catch {
        // Leave the currently selected record visible if refresh fails.
      } finally {
        if (active) setLoadingDetail(false);
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [facture?.id, service, setSelectedFacture]);

  useEffect(() => {
    let active = true;

    const loadRelances = async () => {
      if (!facture?.id) return;
      setLoadingRelances(true);

      try {
        const service = new FinanceRelanceService();
        const result = await service.getHistory({
          facture_id: facture.id,
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
  }, [facture?.id]);

  if (!facture) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Facture indisponible</h3>
        <p className="mt-2 text-sm text-slate-500">
          Selectionne une facture depuis la liste pour afficher ses details.
        </p>
      </div>
    );
  }

  const canEdit = (facture.paiements?.length ?? 0) === 0;
  const activePaiements = (facture.paiements ?? []).filter(
    (item) => (item.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE",
  );
  const totalPaid =
    (facture.echeances?.length ?? 0) > 0
      ? (facture.echeances ?? []).reduce((sum, item) => {
          const amount =
            typeof item.montant_regle === "number"
              ? item.montant_regle
              : Number(item.montant_regle ?? 0);
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0)
      : activePaiements.reduce((sum, item) => {
          const amount = typeof item.montant === "number" ? item.montant : Number(item.montant ?? 0);
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);
  const hasPlanLinkedEcheances = (facture.echeances ?? []).some((item) => item.plan_paiement_id);
  const canCancel = activePaiements.length === 0 && !hasPlanLinkedEcheances && (facture.statut ?? "").toUpperCase() !== "ANNULEE";
  const canCreateAvoir = (facture.statut ?? "").toUpperCase() !== "ANNULEE" && (facture.nature ?? "FACTURE").toUpperCase() !== "AVOIR";
  const canEmit = (facture.statut ?? "").toUpperCase() === "BROUILLON";

  const openPlan = (planId: string) => {
    queueFinanceNavigationTarget({
      module: "plans_paiement",
      id: planId,
      view: "detail",
    });
    navigate(getFinanceModulePath("plans_paiement"));
  };

  const openPaiement = (paiementId: string) => {
    queueFinanceNavigationTarget({
      module: "paiements",
      id: paiementId,
      view: "detail",
    });
    navigate(getFinanceModulePath("paiements"));
  };

  const handleDownloadPdf = () => {
    const { doc, filename } = buildFacturePdf(facture);
    downloadPdf(doc, filename);
    info("Le PDF de la facture a ete genere.", "success");
  };

  const refreshFacture = async () => {
    if (!facture?.id) return;
    const response = await service.get(facture.id);
    setSelectedFacture(response.data as FactureWithRelations);
  };

  const handleCancelFacture = async () => {
    const motif = window.prompt("Motif d'annulation de la facture", "") ?? "";
    if (motif === null) return;

    try {
      setProcessingAccountingAction(true);
      await service.cancel(facture.id, { motif: motif.trim() || null });
      await refreshFacture();
      info("La facture a ete annulee.", "success");
    } catch (error) {
      info(getApiErrorMessage(error), "error");
    } finally {
      setProcessingAccountingAction(false);
    }
  };

  const handleCreateAvoir = async () => {
    const montantInput = window.prompt(
      "Montant de l'avoir. Laisse vide pour utiliser le solde ouvert.",
      "",
    );

    if (montantInput === null) return;

    const trimmedAmount = montantInput.trim();
    const montant =
      trimmedAmount.length > 0
        ? Number(trimmedAmount.replace(/\s+/g, "").replace(",", "."))
        : null;

    if (trimmedAmount.length > 0 && !Number.isFinite(montant)) {
      info("Le montant saisi pour l'avoir est invalide.", "error");
      return;
    }

    const motif = window.prompt("Motif de l'avoir", "") ?? "";

    try {
      setProcessingAccountingAction(true);
      await service.createAvoir(facture.id, {
        motif: motif.trim() || null,
        montant,
      });
      await refreshFacture();
      info("L'avoir comptable a ete cree.", "success");
    } catch (error) {
      info(getApiErrorMessage(error), "error");
    } finally {
      setProcessingAccountingAction(false);
    }
  };

  const handleApplyAvailableCredit = async () => {
    const motif = window.prompt("Motif du report de credit", "") ?? "";

    try {
      setProcessingAccountingAction(true);
      await service.applyAvailableCredit(facture.id, { motif: motif.trim() || null });
      await refreshFacture();
      info("Le credit disponible a ete applique a cette facture.", "success");
    } catch (error) {
      info(getApiErrorMessage(error), "error");
    } finally {
      setProcessingAccountingAction(false);
    }
  };

  const handleEmitFacture = async () => {
    const motif = window.prompt("Note de validation finale", "") ?? "";

    try {
      setProcessingAccountingAction(true);
      await service.emit(facture.id, { motif: motif.trim() || null });
      await refreshFacture();
      info("La facture a ete emise.", "success");
    } catch (error) {
      info(getApiErrorMessage(error), "error");
    } finally {
      setProcessingAccountingAction(false);
    }
  };

  const handleReinvoice = async () => {
    const motif = window.prompt("Motif de la refacturation", "") ?? "";

    try {
      setProcessingAccountingAction(true);
      const response = await service.reinvoice(facture.id, { motif: motif.trim() || null });
      setSelectedFacture((response?.data?.data ?? facture) as FactureWithRelations);
      info("La refacturation a ete creee.", "success");
    } catch (error) {
      info(getApiErrorMessage(error), "error");
    } finally {
      setProcessingAccountingAction(false);
    }
  };

  const handlePrint = () => {
    const { doc } = buildFacturePdf(facture);
    const opened = previewPdf(doc, true);
    if (!opened) {
      info("Le navigateur a bloque l'aperçu d'impression. Le PDF a ete telecharge a la place.", "warning");
      const fallback = buildFacturePdf(facture);
      downloadPdf(fallback.doc, fallback.filename);
      return;
    }
    info("Aperçu d'impression ouvert pour la facture.", "info");
  };

  const handleSendRelance = async () => {
    if (openInstallments.length === 0) return;

    try {
      setSendingRelance(true);
      const service = new FinanceRelanceService();
      const result = await service.sendRelance({
        facture_id: facture.id,
      });
      const sent = Array.isArray(result.data?.sent) ? (result.data.sent as FinanceRelanceHistoryItem[]) : [];

      if (sent.length > 0) {
        setRelances((current) => {
          const deduped = new Map([...sent, ...current].map((item) => [item.id, item]));
          return [...deduped.values()];
        });
      }

      info("La relance financiere a ete envoyee depuis la facture.", "success");
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
            <h2 className="text-2xl font-semibold text-slate-900">{getFactureDisplayLabel(facture)}</h2>
            <p className="mt-2 text-sm text-slate-500">{getFactureSecondaryLabel(facture)}</p>
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
            {canEdit ? (
              <button
                type="button"
                onClick={() => setRenderedComponent("edit")}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <FiEdit3 />
                Modifier
              </button>
            ) : null}
            {canEmit ? (
              <button
                type="button"
                onClick={() => void handleEmitFacture()}
                disabled={processingAccountingAction}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiBell />
                Valider et emettre
              </button>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                onClick={() => void handleCancelFacture()}
                disabled={processingAccountingAction}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSlash />
                Annuler
              </button>
            ) : null}
            {canCreateAvoir ? (
              <button
                type="button"
                onClick={() => void handleCreateAvoir()}
                disabled={processingAccountingAction}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCcw />
                Creer un avoir
              </button>
            ) : null}
            {(facture.nature ?? "FACTURE").toUpperCase() !== "AVOIR" ? (
              <button
                type="button"
                onClick={() => void handleReinvoice()}
                disabled={processingAccountingAction}
                className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCcw />
                Refacturer
              </button>
            ) : null}
            {openInstallments.length > 0 ? (
              <button
                type="button"
                onClick={() => void handleApplyAvailableCredit()}
                disabled={processingAccountingAction}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiRefreshCcw />
                Appliquer credit disponible
              </button>
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
            <span className="text-sm font-medium">Total facture</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatMoney(facture.total_montant, facture.devise ?? "MGA")}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCreditCard />
            <span className="text-sm font-medium">Total paye</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatMoney(totalPaid, facture.devise ?? "MGA")}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCalendar />
            <span className="text-sm font-medium">Echeance</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatDate(facture.date_echeance)}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Statut</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{getFactureStatusLabel(facture.statut)}</p>
        </div>
      </section>

      {loadingDetail ? (
        <section className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500 shadow-sm">
          Actualisation du dossier financier...
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Lignes de facture</h3>
          <div className="mt-5 space-y-3">
            {facture.lignes?.map((ligne) => (
              <div key={ligne.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{ligne.libelle}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Quantite {ligne.quantite} - {formatMoney(ligne.prix_unitaire, facture.devise ?? "MGA")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatMoney(ligne.montant, facture.devise ?? "MGA")}
                  </p>
                </div>
              </div>
            ))}
            {(facture.lignes?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">Aucune ligne de facture.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Echeances de paiement</h3>
            <div className="mt-5 space-y-3">
              {facture.echeances?.map((echeance) => (
                <div key={echeance.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {echeance.libelle?.trim() || `Tranche ${echeance.ordre}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Echeance {formatDate(echeance.date_echeance)} - {echeance.statut}
                      </p>
                      {echeance.plan_paiement_id ? (
                        <button
                          type="button"
                          onClick={() => openPlan(echeance.plan_paiement_id as string)}
                          className="mt-3 inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          Ouvrir le plan
                        </button>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatMoney(echeance.montant_prevu, echeance.devise ?? facture.devise ?? "MGA")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Regle {formatMoney(echeance.montant_regle, echeance.devise ?? facture.devise ?? "MGA")} - Reste{" "}
                        {formatMoney(echeance.montant_restant, echeance.devise ?? facture.devise ?? "MGA")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {(facture.echeances?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">Aucune echeance rattachee a cette facture.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Informations</h3>
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <FiUser className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Eleve</p>
                  <p className="mt-1 text-sm text-slate-900">{getFactureSecondaryLabel(facture)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiCalendar className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Emission</p>
                  <p className="mt-1 text-sm text-slate-900">{formatDate(facture.date_emission)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiLayers className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Paiements rattaches</p>
                  <p className="mt-1 text-sm text-slate-900">{facture.paiements?.length ?? 0}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiCreditCard className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Nature</p>
                  <p className="mt-1 text-sm text-slate-900">{getFactureNatureLabel(facture.nature)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiCreditCard className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Remise</p>
                  <p className="mt-1 text-sm text-slate-900">
                    {facture.remise
                      ? `${facture.remise.nom} (${facture.remise.type?.toUpperCase() === "PERCENT" ? `${Number(facture.remise.valeur ?? 0)}%` : Number(facture.remise.valeur ?? 0).toLocaleString("fr-FR")})`
                      : "Aucune remise"}
                  </p>
                </div>
              </div>
              {facture.factureOrigine ? (
                <div className="flex items-start gap-3">
                  <FiRefreshCcw className="mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Facture d'origine</p>
                    <p className="mt-1 text-sm text-slate-900">{facture.factureOrigine.numero_facture}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Corrections comptables</h3>
            <div className="mt-5 space-y-3">
              {facture.operationsFinancieres?.map((operation) => (
                <div key={operation.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{operation.type.replace(/_/g, " ")}</p>
                      <p className="mt-1 text-xs text-slate-500">{operation.motif || "Sans motif"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatMoney(operation.montant ?? 0, facture.devise ?? "MGA")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(operation.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(facture.operationsFinancieres?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">Aucune correction comptable sur cette facture.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Avoirs lies</h3>
            <div className="mt-5 space-y-3">
              {facture.avoirs?.map((avoir) => (
                <div key={avoir.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{avoir.numero_facture}</p>
                      <p className="mt-1 text-xs text-slate-500">{getFactureStatusLabel(avoir.statut)}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatMoney(avoir.total_montant, facture.devise ?? "MGA")}
                    </p>
                  </div>
                </div>
              ))}
              {(facture.avoirs?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">Aucun avoir n'a encore ete cree pour cette facture.</p>
              ) : null}
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
                <p className="text-sm text-slate-500">Aucune relance envoyee pour cette facture.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Historique des paiements</h3>
            <div className="mt-5 space-y-3">
              {facture.paiements?.map((paiement) => (
                <div key={paiement.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {paiement.reference?.trim() || paiement.methode || "Paiement"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(paiement.paye_le)} - {paiement.methode || "Mode non renseigne"} - {(paiement.statut ?? "ENREGISTRE").replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatMoney(paiement.montant, facture.devise ?? "MGA")}
                      </p>
                      <button
                        type="button"
                        onClick={() => openPaiement(paiement.id)}
                        className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        Ouvrir le paiement
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(facture.paiements?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">Aucun paiement rattache a cette facture.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
