import {
  addPdfHeader,
  addPdfTable,
  createPdfDocument,
  savePdf,
} from "../../../../utils/pdf";

type InscriptionPdfData = {
  inscription: {
    id: string;
    statut: string;
    type_inscription?: string | null;
    statut_administratif?: string | null;
    statut_financier?: string | null;
    statut_dossier?: string | null;
    date_inscription: string | Date | null;
    validation_date?: string | Date | null;
    completion_rate: number;
  };
  eleve: {
    code_eleve?: string | null;
    prenom?: string | null;
    nom?: string | null;
    date_naissance?: string | Date | null;
    genre?: string | null;
    adresse?: string | null;
    telephone?: string | null;
    email?: string | null;
  };
  scolarite: {
    annee?: { nom?: string | null } | null;
    niveau?: { nom?: string | null } | null;
    classe?: { nom?: string | null; site?: string | null } | null;
  };
  responsables: Array<{
    nom_complet: string;
    relation?: string | null;
    telephone_principal?: string | null;
    email?: string | null;
    est_responsable_financier?: boolean;
    est_responsable_legal?: boolean;
    est_contact_urgence?: boolean;
  }>;
  finance: {
    total_facture: number;
    total_paye: number;
    reste_a_payer: number;
    statut: string;
    dernier_paiement?: {
      montant: number;
      date: string | Date;
      methode?: string | null;
    } | null;
    prochaine_echeance?: {
      libelle?: string | null;
      date_echeance: string | Date;
      montant_restant: number;
      statut: string;
    } | null;
  };
  documents: {
    status: string;
    items?: Array<{
      nom: string;
      obligatoire: boolean;
      fourni: boolean;
      statut: string;
    }>;
  };
  alerts: Array<{
    type: string;
    gravity: "high" | "medium" | "low";
    message: string;
  }>;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

function formatMoney(value?: number | null, devise = "MGA") {
  return `${Number(value ?? 0).toLocaleString("fr-FR")} ${devise}`;
}

function sanitizeFilenamePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function openPdfWindow(blob: Blob, autoPrint = false) {
  if (typeof window === "undefined") return false;
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

export function buildInscriptionResumePdf(data: InscriptionPdfData) {
  const doc = createPdfDocument("portrait");
  const fullName = [data.eleve.prenom, data.eleve.nom].filter(Boolean).join(" ").trim() || "Eleve";
  const filename = `fiche-inscription-${sanitizeFilenamePart(data.eleve.code_eleve ?? data.inscription.id)}.pdf`;

  let cursorY = addPdfHeader(doc, {
    title: "Resume d'inscription",
    subtitle: fullName,
    metadata: [
      { label: "Matricule", value: data.eleve.code_eleve ?? "-" },
      { label: "Annee scolaire", value: data.scolarite.annee?.nom ?? "-" },
      { label: "Statut inscription", value: data.inscription.statut ?? "-" },
      { label: "Statut dossier", value: data.inscription.statut_dossier ?? data.documents.status ?? "-" },
      { label: "Niveau", value: data.scolarite.niveau?.nom ?? "-" },
      { label: "Classe", value: data.scolarite.classe?.nom ?? "-" },
      { label: "Date inscription", value: formatDate(data.inscription.date_inscription) },
      { label: "Validation", value: formatDate(data.inscription.validation_date) },
    ],
  });

  cursorY = addPdfTable(doc, {
    title: "Identite de l'eleve",
    startY: cursorY + 2,
    head: ["Champ", "Valeur"],
    body: [
      ["Nom complet", fullName],
      ["Date de naissance", formatDate(data.eleve.date_naissance)],
      ["Genre", data.eleve.genre ?? "-"],
      ["Telephone", data.eleve.telephone ?? "-"],
      ["Email", data.eleve.email ?? "-"],
      ["Adresse", data.eleve.adresse ?? "-"],
    ],
  });

  cursorY = addPdfTable(doc, {
    title: "Scolarite",
    startY: cursorY + 4,
    head: ["Champ", "Valeur"],
    body: [
      ["Type d'inscription", data.inscription.type_inscription ?? "-"],
      ["Annee scolaire", data.scolarite.annee?.nom ?? "-"],
      ["Niveau", data.scolarite.niveau?.nom ?? "-"],
      ["Classe", data.scolarite.classe?.nom ?? "-"],
      ["Site", data.scolarite.classe?.site ?? "-"],
      ["Completude", `${data.inscription.completion_rate ?? 0}%`],
    ],
  });

  cursorY = addPdfTable(doc, {
    title: "Responsables",
    startY: cursorY + 4,
    head: ["Nom", "Lien", "Telephone", "Roles"],
    body:
      data.responsables.length > 0
        ? data.responsables.map((item) => [
            item.nom_complet,
            item.relation ?? "-",
            item.telephone_principal ?? "-",
            [
              item.est_responsable_legal ? "Legal" : null,
              item.est_responsable_financier ? "Financier" : null,
              item.est_contact_urgence ? "Urgence" : null,
            ]
              .filter(Boolean)
              .join(", ") || "-",
          ])
        : [["Aucun responsable", "-", "-", "-"]],
  });

  cursorY = addPdfTable(doc, {
    title: "Situation financiere",
    startY: cursorY + 4,
    head: ["Indicateur", "Valeur"],
    body: [
      ["Total facture", formatMoney(data.finance.total_facture)],
      ["Total paye", formatMoney(data.finance.total_paye)],
      ["Reste a payer", formatMoney(data.finance.reste_a_payer)],
      ["Statut financier", data.finance.statut ?? "-"],
      [
        "Dernier paiement",
        data.finance.dernier_paiement
          ? `${formatMoney(data.finance.dernier_paiement.montant)} le ${formatDate(data.finance.dernier_paiement.date)}`
          : "-",
      ],
      [
        "Prochaine echeance",
        data.finance.prochaine_echeance
          ? `${data.finance.prochaine_echeance.libelle ?? "Echeance"} - ${formatDate(data.finance.prochaine_echeance.date_echeance)} - ${formatMoney(data.finance.prochaine_echeance.montant_restant)}`
          : "-",
      ],
    ],
  });

  const missingDocuments = (data.documents.items ?? []).filter(
    (item) => item.obligatoire && (!item.fourni || ["NON_FOURNI", "REJETE", "EXPIRE"].includes((item.statut ?? "").toUpperCase())),
  );

  cursorY = addPdfTable(doc, {
    title: "Dossier administratif",
    startY: cursorY + 4,
    head: ["Document", "Obligatoire", "Fourni", "Statut"],
    body:
      (data.documents.items ?? []).length > 0
        ? (data.documents.items ?? []).map((item) => [
            item.nom,
            item.obligatoire ? "Oui" : "Non",
            item.fourni ? "Oui" : "Non",
            item.statut ?? "-",
          ])
        : [["Aucun document structure", "-", "-", data.documents.status ?? "-"]],
  });

  cursorY = addPdfTable(doc, {
    title: "Actions recommandees",
    startY: cursorY + 4,
    head: ["Type", "Detail"],
    body: [
      ["Statut dossier", data.documents.status ?? "-"],
      [
        "Documents manquants",
        missingDocuments.length > 0 ? missingDocuments.map((item) => item.nom).join(", ") : "Aucun document obligatoire manquant",
      ],
      [
        "Alertes",
        data.alerts.length > 0 ? data.alerts.map((item) => `[${item.type}] ${item.message}`).join(" | ") : "Aucune alerte bloquante",
      ],
    ],
  });

  return { doc, filename };
}

export function previewInscriptionResumePdf(data: InscriptionPdfData, autoPrint = false) {
  const { doc, filename } = buildInscriptionResumePdf(data);
  const opened = openPdfWindow(doc.output("blob"), autoPrint);
  return { opened, filename, doc };
}

export function downloadInscriptionResumePdf(data: InscriptionPdfData) {
  const { doc, filename } = buildInscriptionResumePdf(data);
  savePdf(doc, filename);
  return filename;
}
