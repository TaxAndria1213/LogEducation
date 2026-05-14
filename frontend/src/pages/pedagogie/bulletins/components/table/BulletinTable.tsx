import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import BulletinService, {
  getBulletinDisplayLabel,
  getBulletinGeneralAverage,
  getBulletinSecondaryLabel,
  type BulletinDisplayLine,
  type BulletinWithRelations,
} from "../../../../../services/bulletin.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";
import {
  addPdfHeader,
  addPdfTable,
  createPdfDocument,
  savePdf,
} from "../../../../../utils/pdf";
import { useInfo } from "../../../../../hooks/useInfo";

const formatDate = (value?: Date | string | null) =>
  value ? formatDateWithLocalTimezone(value.toString()).date : "-";

const formatSummaryValue = (
  value: number | string | null | undefined,
  precision = 2,
) => {
  if (typeof value === "number") {
    return value.toFixed(Math.max(0, precision));
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "-";
};

type PdfDocument = ReturnType<typeof createPdfDocument>;

const PDF_TOP_MARGIN = 18;
const PDF_BOTTOM_MARGIN = 18;
const PDF_SIDE_MARGIN = 14;

function getPdfPageHeight(doc: PdfDocument) {
  return doc.internal.pageSize.getHeight();
}

function getPdfPageWidth(doc: PdfDocument) {
  return doc.internal.pageSize.getWidth();
}

function ensurePdfSpace(doc: PdfDocument, cursorY: number, requiredHeight: number) {
  if (cursorY + requiredHeight <= getPdfPageHeight(doc) - PDF_BOTTOM_MARGIN) {
    return cursorY;
  }

  doc.addPage();
  return PDF_TOP_MARGIN;
}

function addWrappedPdfText(
  doc: PdfDocument,
  text: string,
  cursorY: number,
  options?: { x?: number; maxWidth?: number; lineHeight?: number },
) {
  const x = options?.x ?? PDF_SIDE_MARGIN;
  const maxWidth =
    options?.maxWidth ?? getPdfPageWidth(doc) - PDF_SIDE_MARGIN * 2;
  const lineHeight = options?.lineHeight ?? 5;
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  let nextY = cursorY;

  lines.forEach((line) => {
    nextY = ensurePdfSpace(doc, nextY, lineHeight);
    doc.text(line, x, nextY);
    nextY += lineHeight;
  });

  return nextY;
}

async function loadImageAsDataUrl(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Impossible de charger l'image du logo.");
  }

  const blob = await response.blob();
  return new Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" }>(
    (resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        const mimeType = blob.type.toLowerCase();
        const format =
          mimeType.includes("png")
            ? "PNG"
            : mimeType.includes("webp")
              ? "WEBP"
              : "JPEG";
        resolve({ dataUrl: reader.result, format });
        return;
      }
      reject(new Error("Le logo n'a pas pu etre converti pour le PDF."));
    };
    reader.onerror = () => {
      reject(new Error("Le logo n'a pas pu etre lu pour le PDF."));
    };
    reader.readAsDataURL(blob);
    },
  );
}

export default function BulletinTable() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new BulletinService(), []);

  const buildPdf = async (row: BulletinWithRelations) => {
    try {
      const detailResponse = await service.get(row.id);
      const detail = (detailResponse?.data as BulletinWithRelations | undefined) ?? row;
      const display = detail.affichage_bulletin;

      if (!display?.columns?.length || !display?.lines) {
        info(
          "Impossible de generer le PDF : le snapshot d'affichage du bulletin est indisponible.",
          "error",
        );
        return;
      }

      const configuredPrecision = Math.max(
        0,
        Math.min(4, display.template?.rounding_precision ?? 2),
      );
      const hasWideCells = display.lines.some((line) =>
        display.columns.some(
          (column) => (line.display_cells?.[column.key] ?? "").length > 70,
        ),
      );
      const doc = createPdfDocument(
        display.columns.length > 5 || hasWideCells ? "landscape" : "portrait",
      );
      const shouldShowLogo = Boolean(
        display.template?.show_logo && display.branding?.logo_url,
      );
      const headerStartY = shouldShowLogo ? 30 : 18;

      if (shouldShowLogo && display.branding?.logo_url) {
        try {
          const imageData = await loadImageAsDataUrl(display.branding.logo_url);
          doc.addImage(imageData.dataUrl, imageData.format, 14, 10, 26, 14);
        } catch {
          info(
            "Le logo de l'etablissement n'a pas pu etre charge pour ce PDF.",
            "warning",
          );
        }
      }

      const headerY = addPdfHeader(doc, {
        title: "Bulletin de notes",
        subtitle: display.branding?.etablissement_name ?? undefined,
        metadata: [
          { label: "Eleve", value: detail.eleve ? getBulletinDisplayLabel(detail).split(" - ")[0] : "-" },
          { label: "Classe", value: detail.classe?.nom ?? "-" },
          { label: "Periode", value: detail.periode?.nom ?? "-" },
          { label: "Statut", value: detail.statut ?? "-" },
          { label: "Publie le", value: formatDate(detail.publie_le) },
          { label: "Genere le", value: formatDate(new Date()) },
        ],
        startY: headerStartY,
      });

      const pdfLines: BulletinDisplayLine[] =
        display.lines.length > 0
          ? display.lines
          : [
              {
                row_id: "empty",
                matiere_id: "",
                matiere_nom: "Aucune ligne",
                moyenne: null,
                coefficient: null,
                points: null,
                rang: null,
                appreciation: null,
                assessment_details: [],
                display_cells: {
                  subject:
                    "Aucune ligne de bulletin n'a ete generee pour cette configuration.",
                },
              },
            ];

      let cursorY = addPdfTable(doc, {
        startY: headerY,
        head: display.columns.map((column) => column.label),
        body: pdfLines.map((line) =>
          display.columns.map((column) => line.display_cells?.[column.key] ?? "-"),
        ),
        didParseCell: (data) => {
          const rowIndex = (data as typeof data & { row?: { index?: number } }).row
            ?.index;
          const row =
            typeof rowIndex === "number" ? pdfLines[rowIndex] : undefined;
          if (row?.row_type === "section_header") {
            data.cell.styles.fillColor = [226, 232, 240];
            data.cell.styles.textColor = [15, 23, 42];
            data.cell.styles.fontStyle = "bold";
            if (data.column.index > 0) {
              data.cell.text = [""];
            }
          }
        },
      });

      doc.setFontSize(12);
      const summaryLines = [
        display.template?.show_general_average
          ? `Moyenne generale : ${formatSummaryValue(display.summary?.general_average ?? getBulletinGeneralAverage(detail), configuredPrecision)}`
          : null,
        display.template?.show_general_class_average
          ? `Moyenne generale de la classe : ${formatSummaryValue(display.summary?.general_class_average, configuredPrecision)}`
          : null,
        display.template?.show_total_coefficients
          ? `Total coefficients : ${formatSummaryValue(display.summary?.total_coefficients, configuredPrecision)}`
          : null,
        display.template?.show_total_points
          ? `Total points : ${formatSummaryValue(display.summary?.total_points, configuredPrecision)}`
          : null,
        display.template?.show_general_rank
          ? `Rang general : ${formatSummaryValue(display.summary?.rank)}`
          : null,
        display.template?.show_mention
          ? `Mention : ${formatSummaryValue(display.summary?.mention)}`
          : null,
        display.template?.show_decision
          ? `Decision : ${formatSummaryValue(display.summary?.decision)}`
          : null,
        display.template?.show_general_appreciation
          ? `Appreciation generale : ${formatSummaryValue(display.summary?.general_appreciation)}`
          : null,
        display.template?.show_absences
          ? `Absences : ${formatSummaryValue(display.summary?.absence_count)}`
          : null,
        display.template?.show_late_count
          ? `Retards : ${formatSummaryValue(display.summary?.late_count)}`
          : null,
      ].filter((line): line is string => Boolean(line));

      cursorY += 10;
      summaryLines.forEach((line) => {
        cursorY = addWrappedPdfText(doc, line, cursorY + 2, { lineHeight: 6 });
      });

      if (display.template?.show_code_legend && display.code_legend?.length) {
        cursorY = ensurePdfSpace(doc, cursorY + 4, 12);
        doc.setFontSize(11);
        doc.text("Legende :", PDF_SIDE_MARGIN, cursorY);
        cursorY += 6;
        doc.setFontSize(10);
        display.code_legend.forEach((legend) => {
          const numericSuffix =
            typeof legend.numeric_value === "number"
              ? ` (${formatSummaryValue(legend.numeric_value, configuredPrecision)})`
              : "";
          cursorY = addWrappedPdfText(
            doc,
            `${legend.code} = ${legend.label}${numericSuffix}`,
            cursorY,
            {
              x: 18,
              maxWidth: getPdfPageWidth(doc) - PDF_SIDE_MARGIN * 2 - 4,
              lineHeight: 5,
            },
          );
        });
      }

      if (display.warnings?.length) {
        doc.setFontSize(10);
        cursorY = addWrappedPdfText(
          doc,
          `Alertes : ${display.warnings.join(" ")}`,
          cursorY + 6,
          { lineHeight: 5 },
        );
      }

      if (display.template?.show_signature) {
        cursorY = ensurePdfSpace(doc, cursorY + 16, 16);
        const signatureStartX = getPdfPageWidth(doc) - 80;
        const signatureEndX = getPdfPageWidth(doc) - 24;
        doc.line(signatureStartX, cursorY, signatureEndX, cursorY);
        doc.setFontSize(10);
        doc.text("Signature", (signatureStartX + signatureEndX) / 2, cursorY + 5, {
          align: "center",
        });
      }

      const filename = `bulletin-${detail.eleve?.code_eleve ?? detail.id}.pdf`;
      savePdf(doc, filename);
    } catch (error) {
      console.error(error);
      info("Le PDF du bulletin n'a pas pu etre genere.", "error");
    }
  };

  const columns: ColumnDef<BulletinWithRelations>[] = [
    {
      key: "bulletin",
      header: "Bulletin",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getBulletinDisplayLabel(row)}</p>
          <p className="text-xs text-slate-500">{getBulletinSecondaryLabel(row) || "Aucun detail complementaire"}</p>
        </div>
      ),
      sortable: false,
      sortKey: "created_at",
    },
    {
      key: "periode",
      header: "Periode",
      render: (row) => row.periode?.nom ?? "-",
      sortable: false,
      sortKey: "periode.nom",
    },
    {
      key: "moyenne_generale",
      header: "Moy. generale",
      render: (row) => {
        const moy = getBulletinGeneralAverage(row);
        return moy !== null ? moy.toFixed(2) : "-";
      },
      sortable: false,
    },
    {
      key: "statut",
      header: "Statut",
      render: (row) => row.statut ?? "-",
      sortable: false,
      sortKey: "statut",
    },
    {
      key: "publie_le",
      header: "Publie le",
      render: (row) => formatDate(row.publie_le),
      sortable: false,
      sortKey: "publie_le",
    },
  ];

  const actions: RowAction<BulletinWithRelations>[] = [
    {
      label: "Generer",
      variant: "primary",
      show: (row) => !["VALIDE", "PUBLIE"].includes((row.statut ?? "").toUpperCase()),
      onClick: async (row) => {
        await service.generate(row.id);
        tableRef.current?.refresh();
      },
    },
    {
      label: "Valider",
      variant: "secondary",
      show: (row) => !["VALIDE", "PUBLIE"].includes((row.statut ?? "").toUpperCase()),
      onClick: async (row) => {
        await service.validate(row.id);
        tableRef.current?.refresh();
      },
    },
    {
      label: "Publier",
      variant: "primary",
      show: (row) => (row.statut ?? "").toUpperCase() !== "PUBLIE",
      onClick: async (row) => {
        await service.publish(row.id);
        tableRef.current?.refresh();
      },
    },
    {
      label: "PDF",
      variant: "secondary",
      onClick: async (row) => buildPdf(row),
    },
    {
      label: "Supprimer",
      variant: "danger",
      show: (row) => !["VALIDE", "PUBLIE"].includes((row.statut ?? "").toUpperCase()),
      confirm: { title: "Suppression", message: "Supprimer ce bulletin ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<BulletinWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      detailView={{
        title: "Detail du bulletin",
        loadDetailData: async (row) => {
          const response = await service.get(row.id);
          return (response?.data as Record<string, unknown> | undefined) ?? null;
        },
        hiddenKeys: ["display_snapshot_json", "display_legend_json"],
        fieldLabels: {
          general_average: "Moyenne generale",
          general_class_average: "Moyenne generale de la classe",
          general_rank: "Rang general",
          validated_at: "Valide le",
          validated_by: "Valide par",
          publie_le: "Publie le",
          affichage_bulletin: "Affichage bulletin",
          codeLegends: "Legende des codes",
        },
      }}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id
          ? {
              classe: { etablissement_id },
            }
          : {},
        includeSpec: {
          eleve: {
            include: {
              utilisateur: { include: { profil: true } },
            },
          },
          periode: true,
          classe: {
            include: {
              niveau: true,
              site: true,
            },
          },
          lignes: {
            include: {
              details: true,
              matiere: { include: { departement: true } },
            },
          },
          codeLegends: true,
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id
            ? [
                {
                  classe: {
                    etablissement_id,
                  },
                },
              ]
            : []),
          {
            OR: [
              { eleve: { code_eleve: { contains: text } } },
              { eleve: { utilisateur: { profil: { prenom: { contains: text } } } } },
              { eleve: { utilisateur: { profil: { nom: { contains: text } } } } },
              { periode: { nom: { contains: text } } },
              { classe: { nom: { contains: text } } },
              { statut: { contains: text } },
            ],
          },
        ],
      })}
    />
  );
}

