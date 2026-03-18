import React from "react";
import { useAuth } from "../../../../hooks/useAuth";
import { formatDateWithLocalTimezone } from "../../../../app/utils/functions";
import EvenementCalendrierService from "../../../../services/evenementCalendrier.service";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../shared/table/types";
import type { EvenementCalendrier } from "../../../../types/models";

export default function EventsList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new EvenementCalendrierService(), []);

  const baseWhere = etablissement_id ? { etablissement_id } : {};

  const columns: ColumnDef<EvenementCalendrier>[] = [
    {
      key: "titre",
      header: "Titre",
      accessor: "titre",
      sortable: true,
      sortKey: "titre",
    },
    {
      key: "site",
      header: "Site",
      render: (row) => row.site?.nom ?? "-",
    },
    {
      key: "type",
      header: "Type",
      accessor: "type",
      sortable: true,
      sortKey: "type",
    },
    {
      key: "debut",
      header: "Debut",
      render: (row) => formatDateWithLocalTimezone(row.debut.toString()).dateHeure,
      sortable: true,
      sortKey: "debut",
    },
    {
      key: "fin",
      header: "Fin",
      render: (row) => formatDateWithLocalTimezone(row.fin.toString()).dateHeure,
      sortable: true,
      sortKey: "fin",
    },
    {
      key: "description",
      header: "Description",
      render: (row) => row.description ?? "-",
    },
  ];

  const actions: RowAction<EvenementCalendrier>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => console.log("evenement", row.id),
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer cet evenement ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<EvenementCalendrier>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: baseWhere,
        includeSpec: {
          site: true,
        },
        orderBy: { debut: "desc" },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          baseWhere,
          {
            OR: [
              { titre: { contains: text } },
              { type: { contains: text } },
              { description: { contains: text } },
              { site: { nom: { contains: text } } },
            ],
          },
        ],
      })}
    />
  );
}
