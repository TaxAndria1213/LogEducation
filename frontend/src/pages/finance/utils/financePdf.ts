import type { jsPDF } from "jspdf";
import {
  addPdfHeader,
  addPdfTable,
  createPdfDocument,
  getPdfCursorY,
  savePdf,
} from "../../../utils/pdf";
import {
  getFactureDisplayLabel,
  getFactureSecondaryLabel,
  getFactureStatusLabel,
  type FactureWithRelations,
} from "../../../services/facture.service";
import {
  getPaiementDisplayLabel,
  getPaiementSecondaryLabel,
  type PaiementWithRelations,
} from "../../../services/paiement.service";
import {
  getPlanPaiementDisplayLabel,
  getPlanPaiementEcheances,
  getPlanPaiementPaidAmount,
  getPlanPaiementRemainingAmount,
  getPlanPaiementSecondaryLabel,
  getPlanPaiementTotalAmount,
  type PlanPaiementEleveWithRelations,
} from "../../../services/planPaiementEleve.service";

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
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

function sanitizeFilenamePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function openPdfWindow(doc: jsPDF, autoPrint = false) {
  if (typeof window === "undefined") return false;

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const preview = window.open(url, "_blank", "noopener,noreferrer");

  if (!preview) {
    URL.revokeObjectURL(url);
    return false;
  }

  preview.addEventListener(
    "load",
    () => {
      if (autoPrint) {
        window.setTimeout(() => {
          try {
            preview.focus();
            preview.print();
          } catch {
            // noop
          }
        }, 700);
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    { once: true },
  );

  return true;
}

export function downloadPdf(doc: jsPDF, filename: string) {
  savePdf(doc, filename);
}

export function previewPdf(doc: jsPDF, autoPrint = false) {
  return openPdfWindow(doc, autoPrint);
}

export function buildFacturePdf(facture: FactureWithRelations) {
  const devise = facture.devise ?? "MGA";
  const doc = createPdfDocument("portrait");

  let cursorY = addPdfHeader(doc, {
    title: "Facture",
    subtitle: getFactureDisplayLabel(facture),
    metadata: [
      { label: "Numero", value: facture.numero_facture ?? "-" },
      { label: "Eleve", value: getFactureSecondaryLabel(facture) || "-" },
      { label: "Emission", value: formatDate(facture.date_emission) },
      { label: "Echeance", value: formatDate(facture.date_echeance) },
      { label: "Statut", value: getFactureStatusLabel(facture.statut) },
      { label: "Devise", value: devise },
    ],
  });

  cursorY = addPdfTable(doc, {
    title: "Lignes de facture",
    startY: cursorY + 2,
    head: ["Libelle", "Quantite", "Prix unitaire", "Montant"],
    body:
      facture.lignes?.map((ligne) => [
        ligne.libelle ?? "-",
        Number(ligne.quantite ?? 0),
        formatMoney(ligne.prix_unitaire, devise),
        formatMoney(ligne.montant, devise),
      ]) ?? [],
  });

  cursorY = addPdfTable(doc, {
    title: "Echeances",
    startY: cursorY + 8,
    head: ["Tranche", "Date", "Statut", "Prevu", "Regle", "Restant"],
    body:
      facture.echeances?.map((echeance) => [
        echeance.libelle?.trim() || `Tranche ${echeance.ordre}`,
        formatDate(echeance.date_echeance),
        echeance.statut ?? "-",
        formatMoney(echeance.montant_prevu, echeance.devise ?? devise),
        formatMoney(echeance.montant_regle, echeance.devise ?? devise),
        formatMoney(echeance.montant_restant, echeance.devise ?? devise),
      ]) ?? [],
  });

  cursorY = addPdfTable(doc, {
    title: "Paiements",
    startY: cursorY + 8,
    head: ["Reference", "Date", "Methode", "Montant"],
    body:
      facture.paiements?.map((paiement) => [
        paiement.reference?.trim() || "Paiement",
        formatDate(paiement.paye_le),
        paiement.methode ?? "-",
        formatMoney(paiement.montant, devise),
      ]) ?? [],
  });

  const totalPaid = (facture.paiements ?? []).reduce((sum, item) => {
    const amount = typeof item.montant === "number" ? item.montant : Number(item.montant ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const footerY = getPdfCursorY(doc, cursorY) + 10;
  doc.setFontSize(11);
  doc.text(`Total facture : ${formatMoney(facture.total_montant, devise)}`, 14, footerY);
  doc.text(`Total paye : ${formatMoney(totalPaid, devise)}`, 14, footerY + 6);

  return {
    doc,
    filename: `facture-${sanitizeFilenamePart(facture.numero_facture ?? facture.id)}.pdf`,
  };
}

export function buildPaiementReceiptPdf(paiement: PaiementWithRelations) {
  const devise = paiement.facture?.devise ?? "MGA";
  const doc = createPdfDocument("portrait");

  let cursorY = addPdfHeader(doc, {
    title: "Recu de paiement",
    subtitle: getPaiementDisplayLabel(paiement),
    metadata: [
      { label: "Facture", value: paiement.facture?.numero_facture ?? "-" },
      { label: "Eleve", value: getPaiementSecondaryLabel(paiement) || "-" },
      { label: "Date", value: formatDate(paiement.paye_le) },
      { label: "Methode", value: paiement.methode ?? "-" },
      { label: "Reference", value: paiement.reference ?? "-" },
      { label: "Montant", value: formatMoney(paiement.montant, devise) },
    ],
  });

  cursorY = addPdfTable(doc, {
    title: "Affectations du paiement",
    startY: cursorY + 2,
    head: ["Echeance", "Date", "Statut", "Montant affecte"],
    body:
      paiement.affectations?.map((affectation) => [
        affectation.echeance?.libelle?.trim() ||
          (affectation.echeance ? `Echeance ${affectation.echeance.ordre}` : "Echeance"),
        formatDate(affectation.echeance?.date_echeance),
        affectation.echeance?.statut ?? "-",
        formatMoney(affectation.montant, devise),
      ]) ?? [],
  });

  addPdfTable(doc, {
    title: "Echeancier restant",
    startY: cursorY + 8,
    head: ["Echeance", "Date", "Statut", "Prevu", "Regle", "Restant"],
    body:
      paiement.facture?.echeances?.map((echeance) => [
        echeance.libelle?.trim() || `Echeance ${echeance.ordre}`,
        formatDate(echeance.date_echeance),
        echeance.statut ?? "-",
        formatMoney(echeance.montant_prevu, echeance.devise ?? devise),
        formatMoney(echeance.montant_regle, echeance.devise ?? devise),
        formatMoney(echeance.montant_restant, echeance.devise ?? devise),
      ]) ?? [],
  });

  return {
    doc,
    filename: `recu-paiement-${sanitizeFilenamePart(paiement.reference ?? paiement.id)}.pdf`,
  };
}

export function buildPlanPaiementPdf(plan: PlanPaiementEleveWithRelations) {
  const devise = plan.plan_json?.devise ?? "MGA";
  const doc = createPdfDocument("portrait");
  const echeances = getPlanPaiementEcheances(plan);

  let cursorY = addPdfHeader(doc, {
    title: "Plan de paiement",
    subtitle: getPlanPaiementDisplayLabel(plan),
    metadata: [
      { label: "Eleve", value: getPlanPaiementSecondaryLabel(plan) || "-" },
      { label: "Mode", value: plan.plan_json?.mode_paiement ?? "-" },
      { label: "Devise", value: devise },
      { label: "Montant prevu", value: formatMoney(getPlanPaiementTotalAmount(plan), devise) },
      { label: "Montant regle", value: formatMoney(getPlanPaiementPaidAmount(plan), devise) },
      { label: "Reste", value: formatMoney(getPlanPaiementRemainingAmount(plan), devise) },
    ],
  });

  cursorY = addPdfTable(doc, {
    title: "Echeancier",
    startY: cursorY + 2,
    head: ["Tranche", "Date", "Statut", "Prevu", "Regle", "Restant"],
    body: echeances.map((echeance, index) => [
      echeance.libelle?.trim() || `Tranche ${echeance.ordre ?? index + 1}`,
      formatDate(echeance.date),
      echeance.statut ?? "-",
      formatMoney(echeance.montant, echeance.devise ?? devise),
      formatMoney(echeance.paid_amount ?? 0, echeance.devise ?? devise),
      formatMoney(echeance.remaining_amount ?? 0, echeance.devise ?? devise),
    ]),
  });

  const linkedFactures = Array.from(
    new Set(echeances.map((item) => item.facture_id).filter(Boolean)),
  ) as string[];

  if (linkedFactures.length > 0) {
    addPdfTable(doc, {
      title: "Factures liees",
      startY: cursorY + 8,
      head: ["Facture"],
      body: linkedFactures.map((item) => [item]),
    });
  }

  return {
    doc,
    filename: `plan-paiement-${sanitizeFilenamePart(plan.id)}.pdf`,
  };
}
