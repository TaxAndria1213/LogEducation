/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Bulletin, BulletinLigne } from "../../../../../types/models";
import BulletinService from "../../../../../services/bulletin.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

const formatDate = (value?: Date | string | null) =>
  value ? formatDateWithLocalTimezone(value.toString()).date : "-";

const moyenneGenerale = (lignes?: BulletinLigne[]) => {
  if (!lignes?.length) return 0;
  const valid = lignes.filter((l) => typeof l.moyenne === "number");
  if (!valid.length) return 0;
  return valid.reduce((sum, l) => sum + (l.moyenne ?? 0), 0) / valid.length;
};

export default function BulletinTable() {
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new BulletinService(), []);

  const buildPdf = (row: Bulletin) => {
    console.log("🚀 ~ buildPdf ~ row:", row)
    const doc = new jsPDF();
    const fullName = `${row.eleve?.utilisateur?.profil?.nom ?? ""} ${row.eleve?.utilisateur?.profil?.prenom ?? ""}`.trim();
    const headerY = 18;

    doc.setFontSize(16);
    doc.text("Bulletin de notes", 14, headerY);

    doc.setFontSize(11);
    doc.text(`Élève : ${fullName || row.eleve?.code_eleve || "-"}`, 14, headerY + 10);
    doc.text(`Classe : ${row.classe?.nom ?? "-"}`, 14, headerY + 16);
    doc.text(`Période : ${row.periode?.nom ?? "-"}`, 14, headerY + 22);
    doc.text(`Statut : ${row.statut ?? "-"}`, 14, headerY + 28);
    doc.text(`Publié le : ${formatDate(row.publie_le)}`, 120, headerY + 10);
    doc.text(`Généré le : ${formatDate(new Date())}`, 120, headerY + 16);

    const lignes = row.lignes ?? [];
    autoTable(doc, {
      startY: headerY + 35,
      head: [["Matière", "Moyenne", "Commentaire enseignant"]],
      body: lignes.map((l) => [
        l.matiere?.nom ?? "-",
        l.moyenne !== null && l.moyenne !== undefined ? l.moyenne.toFixed(2) : "-",
        l.commentaire_enseignant ?? "",
      ]),
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? headerY + 40;
    const moyenne = moyenneGenerale(lignes);
    doc.setFontSize(12);
    doc.text(`Moyenne générale : ${moyenne.toFixed(2)}`, 14, finalY + 12);

    const filename = `bulletin-${row.eleve?.code_eleve ?? row.id}.pdf`;
    doc.save(filename);
  };

  const columns: ColumnDef<Bulletin>[] = [
    {
      key: "eleve",
      header: "Élève",
      render: (row) => row.eleve?.code_eleve ?? "-",
      sortable: true,
      sortKey: "eleve.code_eleve",
    },
    {
      key: "periode",
      header: "Période",
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
      header: "Moy. générale",
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
      header: "Publié le",
      render: (row) => formatDate(row.publie_le),
      sortable: true,
      sortKey: "publie_le",
    },
  ];

  const actions: RowAction<Bulletin>[] = [
    {
      label: "Générer",
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
    { label: "Voir", variant: "secondary", onClick: (row) => console.log("voir", row.id) },
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
        includeSpec: {
          eleve: {
            include: {
              utilisateur: { include: { profil: true } },
            }
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
