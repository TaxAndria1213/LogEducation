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
  getPaiementMethodLabel,
  getPaiementReceiptStatusLabel,
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

function drawLabeledRow(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const lines = doc.splitTextToSize(value || "-", width);
  doc.text(lines, x, y + 5);
  return y + 5 + lines.length * 4.5;
}

function getPaiementArray(input: PaiementWithRelations | PaiementWithRelations[]) {
  return Array.isArray(input) ? input.filter(Boolean) : [input];
}

function getEleveFullName(paiement?: PaiementWithRelations | null) {
  const profil = paiement?.facture?.eleve?.utilisateur?.profil;
  const label = `${profil?.prenom ?? ""} ${profil?.nom ?? ""}`.trim();
  return label || paiement?.facture?.eleve?.code_eleve || "Eleve non renseigne";
}

function getPayeurLabel(paiements: PaiementWithRelations[]) {
  const paiement = paiements.find((item) => item.payeur_nom?.trim()) ?? paiements[0];
  if (!paiement) return "Payeur non renseigne";
  const payeurNom = paiement.payeur_nom?.trim();
  if (payeurNom) return payeurNom;
  return getEleveFullName(paiement);
}

function getPayeurReferenceLabel(paiements: PaiementWithRelations[]) {
  const paiement = paiements.find((item) => item.payeur_reference?.trim()) ?? paiements[0];
  return paiement?.payeur_reference?.trim() || "-";
}

function getEtablissementLabel(paiements: PaiementWithRelations[]) {
  const etablissement = paiements[0]?.facture?.etablissement;
  if (!etablissement) return "Etablissement scolaire";
  return [etablissement.nom, etablissement.code].filter(Boolean).join(" - ");
}

function getReceiptReferenceLabel(paiements: PaiementWithRelations[]) {
  if (paiements.length <= 1) {
    return paiements[0]?.reference?.trim() || "-";
  }

  return paiements
    .map((item) => item.reference?.trim())
    .filter(Boolean)
    .join(", ") || "-";
}

function getReceiptNumberLabel(paiements: PaiementWithRelations[]) {
  if (paiements.length <= 1) {
    return paiements[0]?.numero_recu?.trim() || paiements[0]?.reference?.trim() || "-";
  }

  return `Encaissement mixte (${paiements.length} lignes)`;
}

function getReceiptTypeLabel(paiements: PaiementWithRelations[]) {
  return paiements.length > 1 ? "Recu d'encaissement mixte" : "Recu de paiement";
}

function collectAffectationRows(paiements: PaiementWithRelations[], devise: string) {
  const registry = new Map<
    string,
    {
      libelle: string;
      date: string;
      statut: string;
      montant: number;
    }
  >();

  paiements.forEach((paiement, paiementIndex) => {
    (paiement.affectations ?? []).forEach((affectation, index) => {
      const echeance = affectation.echeance;
      const key = echeance?.id ?? `${paiement.id}-${index}`;
      const current = registry.get(key);
      registry.set(key, {
        libelle:
          echeance?.libelle?.trim() ||
          (echeance ? `Echeance ${echeance.ordre}` : `Affectation ${paiementIndex + 1}.${index + 1}`),
        date: formatDate(echeance?.date_echeance),
        statut: echeance?.statut ?? "-",
        montant: Number((current?.montant ?? 0) + Number(affectation.montant ?? 0)),
      });
    });
  });

  return Array.from(registry.values()).map((item) => [
    item.libelle,
    item.date,
    item.statut,
    formatMoney(item.montant, devise),
  ]);
}

function collectPaymentRows(paiements: PaiementWithRelations[], devise: string) {
  return paiements.map((paiement) => [
    paiement.numero_recu ?? "-",
    getPaiementMethodLabel(paiement.methode),
    paiement.reference ?? "-",
    formatMoney(paiement.montant, devise),
  ]);
}

function getOverpaymentAmount(paiements: PaiementWithRelations[]) {
  return paiements.reduce((sum, paiement) => {
    const amount = (paiement.operationsFinancieres ?? []).reduce((inner, operation) => {
      if ((operation.type ?? "").toUpperCase() !== "TROP_PERCU") return inner;
      const numeric =
        typeof operation.montant === "number"
          ? operation.montant
          : Number(operation.montant ?? 0);
      return inner + (Number.isFinite(numeric) ? numeric : 0);
    }, 0);
    return sum + amount;
  }, 0);
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

export function buildPaiementReceiptPdf(paiementInput: PaiementWithRelations | PaiementWithRelations[]) {
  const paiements = getPaiementArray(paiementInput);
  const paiement = paiements[0];
  const devise = paiement?.facture?.devise ?? "MGA";
  const doc = createPdfDocument("portrait");
  const pageWidth = doc.internal.pageSize.getWidth();
  const receiptNumber = getReceiptNumberLabel(paiements);
  const receiptType = getReceiptTypeLabel(paiements);
  const receiptStatus = getPaiementReceiptStatusLabel(paiement?.statut);
  const totalAmount = paiements.reduce((sum, item) => sum + Number(item.montant ?? 0), 0);
  const overpaymentAmount = getOverpaymentAmount(paiements);
  const allocatedAmount = Math.max(0, totalAmount - overpaymentAmount);
  const eleveLabel = getEleveFullName(paiement);
  const payeurLabel = getPayeurLabel(paiements);
  const factureLabel = paiement?.facture ? getFactureDisplayLabel(paiement.facture) : "-";
  const factureSecondary = paiement ? getPaiementSecondaryLabel(paiement) : "";
  const etablissementLabel = getEtablissementLabel(paiements);

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(14, 14, pageWidth - 28, 26, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(etablissementLabel, 18, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Document financier genere automatiquement par le module Finance", 18, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(receiptType.toUpperCase(), pageWidth - 18, 24, { align: "right" });
  doc.setFontSize(10);
  doc.text(`No ${receiptNumber}`, pageWidth - 18, 30, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(receiptStatus, pageWidth - 18, 35, { align: "right" });

  if ((paiement?.statut ?? "").toUpperCase() === "ANNULE" || (paiement?.statut ?? "").toUpperCase() === "REMBOURSE") {
    doc.setTextColor(203, 213, 225);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.text(
      (paiement?.statut ?? "").toUpperCase() === "ANNULE" ? "RECU ANNULE" : "RECU REMBOURSE",
      pageWidth / 2,
      155,
      { align: "center", angle: 24 },
    );
  }

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 46, pageWidth - 28, 38, 4, 4, "FD");
  let leftY = drawLabeledRow(doc, "Recu de", payeurLabel, 18, 54, 78);
  leftY = drawLabeledRow(doc, "Eleve concerne", eleveLabel, 18, leftY + 2, 78);
  drawLabeledRow(
    doc,
    "Nature",
    factureSecondary || "Reglement de frais scolaires",
    18,
    leftY + 2,
    78,
  );

  let rightY = drawLabeledRow(doc, "Date de paiement", formatDate(paiement?.paye_le), 110, 54, 78);
  rightY = drawLabeledRow(doc, "Facture", factureLabel, 110, rightY + 2, 78);
  rightY = drawLabeledRow(
    doc,
    "Mode / reference",
    paiements.length > 1
      ? "Paiement mixte - voir ventilation ci-dessous"
      : `${getPaiementMethodLabel(paiement?.methode)}${paiement?.reference ? ` / ${paiement.reference}` : ""}`,
    110,
    rightY + 2,
    78,
  );
  drawLabeledRow(doc, "Reference payeur", getPayeurReferenceLabel(paiements), 110, rightY + 2, 78);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 90, pageWidth - 28, 20, 4, 4, "FD");
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("MONTANT RECU", 18, 98);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(18);
  doc.text(formatMoney(totalAmount, devise), 18, 106);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Montant affecte : ${formatMoney(allocatedAmount, devise)}`, 110, 100);
  doc.text(`Credit / trop-percu : ${formatMoney(overpaymentAmount, devise)}`, 110, 106);

  let cursorY = 118;

  cursorY = addPdfTable(doc, {
    title: "Detail des affectations",
    startY: cursorY,
    head: ["Echeance", "Date", "Statut", "Montant affecte"],
    body: collectAffectationRows(paiements, devise),
  });

  if (paiements.length > 1) {
    cursorY = addPdfTable(doc, {
      title: "Ventilation des reglements",
      startY: cursorY + 8,
      head: ["Recu", "Mode", "Reference", "Montant"],
      body: collectPaymentRows(paiements, devise),
    });
  }

  cursorY = addPdfTable(doc, {
    title: "Situation apres encaissement",
    startY: cursorY + 8,
    head: ["Echeance", "Date", "Statut", "Prevu", "Regle", "Restant"],
    body:
      paiement?.facture?.echeances?.map((echeance) => [
        echeance.libelle?.trim() || `Echeance ${echeance.ordre}`,
        formatDate(echeance.date_echeance),
        echeance.statut ?? "-",
        formatMoney(echeance.montant_prevu, echeance.devise ?? devise),
        formatMoney(echeance.montant_regle, echeance.devise ?? devise),
        formatMoney(echeance.montant_restant, echeance.devise ?? devise),
      ]) ?? [],
  });

  const footerY = getPdfCursorY(doc, cursorY) + 10;
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, footerY, pageWidth - 28, 26, 4, 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Synthese du recu", 18, footerY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Encaisse par : ${paiement?.recu_par ?? "-"}`, 18, footerY + 14);
  doc.text(`Reference externe : ${getReceiptReferenceLabel(paiements)}`, 18, footerY + 20);
  doc.text(`Montant total : ${formatMoney(totalAmount, devise)}`, 110, footerY + 14);
  doc.text(`Credit disponible : ${formatMoney(overpaymentAmount, devise)}`, 110, footerY + 20);

  const signatureY = footerY + 38;
  doc.setDrawColor(148, 163, 184);
  doc.line(22, signatureY, 72, signatureY);
  doc.line(82, signatureY, 132, signatureY);
  doc.line(142, signatureY, 192, signatureY);
  doc.setFontSize(9);
  doc.text("Le payeur", 47, signatureY + 5, { align: "center" });
  doc.text("Le caissier", 107, signatureY + 5, { align: "center" });
  doc.text("Cachet etablissement", 167, signatureY + 5, { align: "center" });

  return {
    doc,
    filename: `recu-paiement-${sanitizeFilenamePart(
      paiement?.numero_recu ?? paiement?.reference ?? paiement?.id ?? "paiement",
    )}.pdf`,
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
