import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { ParentTuteur } from "../../../../../types/models";
import ParentTuteurService from "../../../../../services/parentTuteur.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
// import { useInfo } from "../../../../../hooks/useInfo";

export default function ParentTuteurList() {
  // const { info } = useInfo();
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new ParentTuteurService(), []);

  const columns: ColumnDef<ParentTuteur>[] = [
    {
      key: "nom_complet",
      header: "Nom complet",
      accessor: "nom_complet",
      sortable: true,
      sortKey: "nom_complet",
    },
    {
      key: "telephone",
      header: "Téléphone",
      accessor: "telephone",
    },
    {
      key: "email",
      header: "Email",
      accessor: "email",
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

  const actions: RowAction<ParentTuteur>[] = [
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
    <DataTable<ParentTuteur>
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
        OR: [
          { nom_complet: { contains: text } },
          { email: { contains: text } },
          { telephone: { contains: text } },
        ],
        etablissement_id,
      })}
    />
  );
}
