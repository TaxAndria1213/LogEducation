import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Salle } from "../../../../../types/models";
import SalleService from "../../../../../services/salle.service";
// import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../hooks/useAuth";

export default function SalleList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => SalleService, []);

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
      header: "Capacité",
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
    // {
    //   key: "created_at",
    //   header: "Créé le",
    //   accessor: "created_at",
    //   sortable: true,
    //   sortKey: "created_at",
    //   render: (row) => {
    //     const date = formatDateWithLocalTimezone(row.created_at.toString());
    //     return date.date;
    //   }
    // },
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
        message: "Voulez-vous supprimer ce site ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        // DataTable refresh auto? (ici non) -> on préfère passer action via hook,
        // mais simplest: on force reload via window ou via un ref.
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
        // Exemple: includes relationnelles
        // includeAll: true,
        includes: ["site"],
        where: { site: { etablissement_id } },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { nom: { contains: text } },
          { type: { contains: text } },
        ],
      })}
    />
  );
}
