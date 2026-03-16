/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { IdentifiantEleve } from "../../../../../types/models";
import IdentifiantEleveService from "../../../../../services/identifiantEleve.service";
// import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
// import { useInfo } from "../../../../../hooks/useInfo";

export default function IdentifiantEleveList() {
  // const { info } = useInfo();
  // const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new IdentifiantEleveService(), []);

  const columns: ColumnDef<IdentifiantEleve>[] = [
    {
      key: "type",
      header: "Type",
      accessor: "type",
      sortable: true,
      sortKey: "type",
    },
    {
      key: "valeur",
      header: "Valeur",
      accessor: "valeur",
      sortable: true,
      sortKey: "valeur",
    },
    {
      key: "eleve",
      header: "Élève",
      render: (row: any) => row.eleve?.code_eleve ?? row.eleve_id,
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
      },
    },
  ];

  const actions: RowAction<IdentifiantEleve>[] = [
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
    <DataTable<IdentifiantEleve>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: { eleve: true },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { type: { contains: text } },
          { valeur: { contains: text } },
          { eleve: { code_eleve: { contains: text } } },
        ],
        // etablissement_id,
      })}
    />
  );
}
