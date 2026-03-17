import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Bulletin } from "../../../../../types/models";
import BulletinService from "../../../../../services/bulletin.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function BulletinTable() {
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new BulletinService(), []);

  const columns: ColumnDef<Bulletin>[] = [
    {
      key: "eleve",
      header: "élève",
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
      key: "statut",
      header: "Statut",
      accessor: "statut",
      sortable: true,
      sortKey: "statut",
    },
    {
      key: "publie_le",
      header: "Publié le",
      render: (row) =>
        row.publie_le
          ? formatDateWithLocalTimezone(row.publie_le.toString()).date
          : "-",
      sortable: true,
      sortKey: "publie_le",
    },
  ];

  const actions: RowAction<Bulletin>[] = [
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
        includeSpec: { eleve: true, periode: true, classe: true },
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
