import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Site } from "../../../../../types/models";
import SiteService from "../../../../../services/site.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../hooks/useAuth";

export default function SiteList() {
    const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new SiteService(), []);

  const columns: ColumnDef<Site>[] = [
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "telephone",
      header: "Téléphone",
      accessor: "telephone",
      sortable: true,
      sortKey: "telephone",
    },
    {
      key: "adresse",
      header: "Adresse",
      accessor: "adresse",
      sortable: true,
      sortKey: "adresse",
    },
    {
      key: "created_at",
      header: "Créé le",
      accessor: "created_at",
      sortable: true,
      sortKey: "created_at",
      render: (row) => {
        const date = formatDateWithLocalTimezone(row.created_at.toString());
        return date.date;
      }
    },
  ];

  const actions: RowAction<Site>[] = [
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
    <DataTable<Site>
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
        // includes: ["etablissement"],
        where: { etablissement_id }
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [{ telephone: { contains: text } }, { nom: { contains: text } }, { adresse: { contains: text } }],
      })}
    />
  );
}
