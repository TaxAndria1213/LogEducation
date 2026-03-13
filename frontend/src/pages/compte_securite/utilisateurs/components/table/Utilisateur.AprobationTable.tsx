import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Utilisateur } from "../../../../../types/models";
import UtilisateurService from "../../../../../services/utilisateur.service";
import TableTooltip from "../../../../../components/alert/TableTooltip";
import type { AproveUserDataType } from "../../../../../types/types";
import { useInfo } from "../../../../../hooks/useInfo";

export default function ApprobationList() {
  const { info } = useInfo();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new UtilisateurService(), []);

  const columns: ColumnDef<Utilisateur>[] = [
    {
      key: "email",
      header: "Email",
      accessor: "email",
      render: (row) => {
        return <TableTooltip info={row.email as string} />;
      },
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
    {
      key: "",
      header: "Option",
      render: (row) => {
        return row.scope_json
          ? JSON.parse(row.scope_json as string).option
          : "-";
      },
      accessor: "scope_json",
      sortable: true,
      sortKey: "scope_json",
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
        message: "Voulez-vous supprimer cet utilisateur ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        // DataTable refresh auto? (ici non) -> on préfère passer action via hook,
        // mais simplest: on force reload via window ou via un ref.
        tableRef.current?.refresh();
      },
    },
    {
      label: "Approuver",
      variant: "primary",
      onClick: async (row) => {
        if (row.statut === "ACTIF") {
          info("Cet utilisateur est déjà actif", "info");
          return;
        }
        const dataAprovment: AproveUserDataType = JSON.parse(
          row.scope_json as string,
        ).data as AproveUserDataType;
        console.log("🚀 ~ ApprobationList ~ dataAprovment:", dataAprovment);
        const data = await service.aproveUser(dataAprovment);
        console.log("🚀 ~ ApprobationList ~ data:", data);
        // await service.aproveUser(row.scope_json);
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
        where: { statut: "INACTIF" }, // Filtre pour n'afficher que les utilisateurs en attente d'approbation
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [{ telephone: { contains: text } }, { email: { contains: text } }],
      })}
    />
  );
}
