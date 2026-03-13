import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Utilisateur } from "../../../../../types/models";
import UtilisateurService from "../../../../../services/utilisateur.service";
import { useAuth } from "../../../../../auth/AuthContext";

export default function UtilisateurList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new UtilisateurService(), []);

  const columns: ColumnDef<Utilisateur>[] = [
    {
      key: "email",
      header: "Email",
      accessor: "email",
      sortable: true,
      sortKey: "email",
    },
    {
      key: "telephone",
      header: "Téléphone",
      accessor: "telephone",
      sortable: true,
      sortKey: "telephone",
    },
    {
      key: "statut",
      header: "Statut",
      accessor: "statut",
      sortable: true,
      sortKey: "statut",
    },
  ];

  const actions: RowAction<Utilisateur>[] = [
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
    <DataTable<Utilisateur>
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
        OR: [{ email: { contains: text } }, { telephone: { contains: text } }],
        etablissement_id,
      })}

    />
  );
}
