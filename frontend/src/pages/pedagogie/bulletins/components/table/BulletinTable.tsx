import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import BulletinService, {
  getBulletinAverage,
  getBulletinDisplayLabel,
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

export default function BulletinTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new BulletinService(), []);

  const buildPdf = (row: BulletinWithRelations) => {
    const doc = createPdfDocument();

    const headerY = addPdfHeader(doc, {
      title: "Bulletin de notes",
      metadata: [
        { label: "Eleve", value: row.eleve ? getBulletinDisplayLabel(row).split(" - ")[0] : "-" },
        { label: "Classe", value: row.classe?.nom ?? "-" },
        { label: "Periode", value: row.periode?.nom ?? "-" },
        { label: "Statut", value: row.statut ?? "-" },
        { label: "Publie le", value: formatDate(row.publie_le) },
        { label: "Genere le", value: formatDate(new Date()) },
      ],
    });

    const lignes = row.lignes ?? [];
    const finalY = addPdfTable(doc, {
      startY: headerY,
      head: ["Matiere", "Moyenne", "Rang", "Commentaire enseignant"],
      body: lignes.map((l) => [
        l.matiere?.nom ?? "-",
        l.moyenne !== null && l.moyenne !== undefined ? l.moyenne.toFixed(2) : "-",
        l.rang ?? "-",
        l.commentaire_enseignant ?? "",
      ]),
    });

    const moyenne = getBulletinAverage(lignes);
    doc.setFontSize(12);
    doc.text(
      `Moyenne generale : ${moyenne !== null ? moyenne.toFixed(2) : "-"}`,
      14,
      finalY + 12,
    );

    const filename = `bulletin-${row.eleve?.code_eleve ?? row.id}.pdf`;
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
        const moy = getBulletinAverage(row.lignes);
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
      onClick: (row) => buildPdf(row),
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

