import React from "react";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import type { RowAction, ColumnDef } from "../../../../../shared/table/types";
import { useAuth } from "../../../../../hooks/useAuth";
import salleService from "../../../../../services/salle.service";
import type { Salle } from "../../../../../types/models";

export default function SalleList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => salleService, []);

  const columns: ColumnDef<Salle>[] = [
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "site",
      header: "Site",
      render: (row) => row.site?.nom ?? "-",
      sortable: true,
      sortKey: "site",
    },
    {
      key: "capacite",
      header: "Capacite",
      accessor: "capacite",
      sortable: true,
      sortKey: "capacite",
    },
    {
      key: "type",
      header: "Type",
      accessor: "type",
      sortable: true,
      sortKey: "type",
    },
  ];

  const actions: RowAction<Salle>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => {
        console.log("voir", row.id);
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Voulez-vous supprimer cette salle ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<Salle>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includes: ["site"],
        where: { site: { etablissement_id } },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [{ nom: { contains: text } }, { type: { contains: text } }],
      })}
    />
  );
}
