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
  type BulletinWithRelations,
} from "../../../../../services/bulletin.service";
import { getEleveDisplayLabel } from "../../../../../services/note.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";
import {
  addPdfHeader,
  addPdfTable,
  createPdfDocument,
  savePdf,
} from "../../../../../utils/pdf";

const formatDate = (value?: Date | string | null) =>
  value ? formatDateWithLocalTimezone(value.toString()).date : "-";

const formatSummaryValue = (value: number | string | null | undefined) => {
  if (typeof value === "number") {
    return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "-";
};

export default function BulletinTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new BulletinService(), []);

  const buildPdf = async (row: BulletinWithRelations) => {
    const detailResponse = await service.get(row.id);
    const detail = (detailResponse?.data as BulletinWithRelations | undefined) ?? row;
    const doc = createPdfDocument();
    const display = detail.affichage_bulletin;
    const headerStartY = display?.template?.show_logo ? 30 : 18;
    const pdfColumns =
      display?.columns?.length
        ? display.columns
        : [
            { key: "subject", label: "Matiere" },
            { key: "average", label: "Moyenne" },
            { key: "rank", label: "Rang" },
            { key: "appreciation", label: "Commentaire enseignant" },
          ];

    if (display?.template?.show_logo) {
      doc.setDrawColor(148, 163, 184);
      doc.rect(14, 12, 24, 12);
      doc.setFontSize(8);
      doc.text("LOGO", 26, 19, { align: "center" });
    }

    const headerY = addPdfHeader(doc, {
      title: "Bulletin de notes",
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

    const lignes = detail.affichage_bulletin?.lines ?? [];
    const finalY = addPdfTable(doc, {
      startY: headerY,
      head: pdfColumns.map((column) => column.label),
      body:
        lignes.length > 0
          ? lignes.map((line) =>
              pdfColumns.map((column) => line.display_cells?.[column.key] ?? "-"),
            )
          : (detail.lignes ?? []).map((line) => [
              line.matiere?.nom ?? "-",
              line.moyenne !== null && line.moyenne !== undefined ? line.moyenne.toFixed(2) : "-",
              line.rang ?? "-",
              line.commentaire_enseignant ?? "",
            ]),
    });

    doc.setFontSize(12);
    const summaryLines = [
      display?.template?.show_general_average
        ? `Moyenne generale : ${formatSummaryValue(display?.summary?.general_average ?? getBulletinGeneralAverage(detail))}`
        : null,
      display?.template?.show_total_coefficients
        ? `Total coefficients : ${formatSummaryValue(display?.summary?.total_coefficients)}`
        : null,
      display?.template?.show_total_points
        ? `Total points : ${formatSummaryValue(display?.summary?.total_points)}`
        : null,
      display?.template?.show_general_rank
        ? `Rang general : ${formatSummaryValue(display?.summary?.rank)}`
        : null,
      display?.template?.show_mention
        ? `Mention : ${formatSummaryValue(display?.summary?.mention)}`
        : null,
      display?.template?.show_decision
        ? `Decision : ${formatSummaryValue(display?.summary?.decision)}`
        : null,
      display?.template?.show_general_appreciation
        ? `Appreciation generale : ${formatSummaryValue(display?.summary?.general_appreciation)}`
        : null,
      display?.template?.show_absences
        ? `Absences : ${formatSummaryValue(display?.summary?.absence_count)}`
        : null,
      display?.template?.show_late_count
        ? `Retards : ${formatSummaryValue(display?.summary?.late_count)}`
        : null,
    ].filter((line): line is string => Boolean(line));

    summaryLines.forEach((line, index) => {
      doc.text(line, 14, finalY + 12 + index * 8);
    });

    if (display?.warnings?.length) {
      doc.setFontSize(10);
      doc.text(`Alertes : ${display.warnings.join(" ")}`, 14, finalY + 18 + summaryLines.length * 8);
    }

    if (display?.template?.show_signature) {
      const signatureY = finalY + 32 + summaryLines.length * 8 + (display.warnings?.length ? 10 : 0);
      doc.line(130, signatureY, 190, signatureY);
      doc.setFontSize(10);
      doc.text("Signature", 160, signatureY + 5, { align: "center" });
    }

    const filename = `bulletin-${detail.eleve?.code_eleve ?? detail.id}.pdf`;
    savePdf(doc, filename);
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
      onClick: async (row) => {
        await service.generate(row.id);
        tableRef.current?.refresh();
      },
    },
    {
      label: "PDF",
      variant: "secondary",
      onClick: async (row) => buildPdf(row),
    },
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => console.log("voir", row.id),
    },
    {
      label: "Supprimer",
      variant: "danger",
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
          lignes: { include: { matiere: { include: { departement: true } } } },
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

