import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { NiveauScolaire } from "../../../../../types/models";
import NiveauService from "../../../../../services/niveau.service";
import { useAuth } from "../../../../../auth/AuthContext";
// import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
// import { useInfo } from "../../../../../hooks/useInfo";

export default function NiveauList() {
  // const { info } = useInfo();
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new NiveauService(), []);

  const columns: ColumnDef<NiveauScolaire>[] = [
    {
      key: "ordre",
      header: "Ordre",
      accessor: "ordre",
      sortable: true,
      sortKey: "ordre",
    },
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
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
    //   },
    // },
  ];

  const actions: RowAction<NiveauScolaire>[] = [
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
        message: "Voulez-vous supprimer ce niveau ?",
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
    <DataTable<NiveauScolaire>
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
        where: { etablissement_id },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [{ nom: { contains: text } }],
        etablissement_id,
      })}
    />
  );
}
