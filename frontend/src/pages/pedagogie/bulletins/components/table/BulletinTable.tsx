import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Bulletin, BulletinLigne } from "../../../../../types/models";
import BulletinService from "../../../../../services/bulletin.service";
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

const moyenneGenerale = (lignes?: BulletinLigne[]) => {
  if (!lignes?.length) return 0;
  const valid = lignes.filter((l) => typeof l.moyenne === "number");
  if (!valid.length) return 0;
  return valid.reduce((sum, l) => sum + (l.moyenne ?? 0), 0) / valid.length;
};

export default function BulletinTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new BulletinService(), []);

  const buildPdf = (row: Bulletin) => {
    const doc = createPdfDocument();
    const fullName =
      `${row.eleve?.utilisateur?.profil?.nom ?? ""} ${row.eleve?.utilisateur?.profil?.prenom ?? ""}`.trim();

    const headerY = addPdfHeader(doc, {
      title: "Bulletin de notes",
      metadata: [
        { label: "Eleve", value: fullName || row.eleve?.code_eleve || "-" },
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
      head: ["Matiere", "Moyenne", "Commentaire enseignant"],
      body: lignes.map((l) => [
        l.matiere?.nom ?? "-",
        l.moyenne !== null && l.moyenne !== undefined
          ? l.moyenne.toFixed(2)
          : "-",
        l.commentaire_enseignant ?? "",
      ]),
    });

    const moyenne = moyenneGenerale(lignes);
    doc.setFontSize(12);
    doc.text(`Moyenne generale : ${moyenne.toFixed(2)}`, 14, finalY + 12);

    const filename = `bulletin-${row.eleve?.code_eleve ?? row.id}.pdf`;
    savePdf(doc, filename);
  };

  const columns: ColumnDef<Bulletin>[] = [
    {
      key: "eleve",
      header: "Eleve",
      render: (row) => row.eleve?.code_eleve ?? "-",
      sortable: true,
      sortKey: "eleve.code_eleve",
    },
    {
      key: "periode",
      header: "Periode",
      render: (row) => row.periode?.nom ?? "-",
      sortable: true,
      sortKey: "periode.nom",
    },
    {
      key: "classe",
      header: "Classe",
      render: (row) => row.classe?.nom ?? "-",
      sortable: true,
      sortKey: "classe.nom",
    },
    {
      key: "moyenne_generale",
      header: "Moy. generale",
      render: (row) => {
        const moy = moyenneGenerale(row.lignes);
        return row.lignes?.length ? moy.toFixed(2) : "-";
      },
    },
    {
      key: "statut",
      header: "Statut",
      accessor: "statut",
      sortable: true,
      sortKey: "statut",
    },
    {
      key: "publie_le",
      header: "Publie le",
      render: (row) => formatDate(row.publie_le),
      sortable: true,
      sortKey: "publie_le",
    },
  ];

  const actions: RowAction<Bulletin>[] = [
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
    <DataTable<Bulletin>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: {
          classe: { etablissement_id: etablissement_id },
        },
        includeSpec: {
          eleve: {
            include: {
              utilisateur: { include: { profil: true } },
            },
          },
          periode: true,
          classe: true,
          lignes: { include: { matiere: true } },
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { eleve: { code_eleve: { contains: text } } },
          { periode: { nom: { contains: text } } },
          { statut: { contains: text } },
        ],
      })}
    />
  );
}
