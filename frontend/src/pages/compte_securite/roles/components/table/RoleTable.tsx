import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserPen } from "@fortawesome/free-solid-svg-icons";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Role } from "../../../../../types/models";
import RoleService from "../../../../../services/role.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import TableTooltip from "../../../../../components/alert/TableTooltip";
import { useInfo } from "../../../../../hooks/useInfo";
import { styles } from "../../../../../styles/styles";

export default function RoleList() {
  const { info } = useInfo();
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new RoleService(), []);

  const columns: ColumnDef<Role>[] = [
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
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

  const actions: RowAction<Role>[] = [
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
        message: "Voulez-vous supprimer ce role ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        // DataTable refresh auto? (ici non) -> on préfère passer action via hook,
        // mais simplest: on force reload via window ou via un ref.
        tableRef.current?.refresh();
      },
    },
    {
      label: "Copier lien de création",
      render: (row) => (
        <TableTooltip
          info={`Copier le lien de création d'utilisateur dans ${row.nom}`}
        >
          <FontAwesomeIcon icon={faUserPen} color={styles.color.primary} />
        </TableTooltip>
      ),
      onClick: (row) => {
        const roleId = row?.id;
        const etabId = etablissement_id;

        if (roleId == null || etabId == null) {
          // à toi de choisir : throw, return, toast, etc.
          console.warn(
            "Impossible de générer l’URL : role_id ou etablissement_id manquant",
            {
              roleId,
              etabId,
            },
          );
        } else {
          const url = new URL("/compte/creation/", window.location.origin);
          url.searchParams.set("role_id", String(roleId));
          url.searchParams.set("etablissement_id", String(etabId));
          url.searchParams.set("role_name", row.nom);

          const finalUrl = url.toString();
          navigator.clipboard.writeText(finalUrl);
          info(
            `Lien de création d'utilisateur de ${row.nom} copié dans le presse papier.`,
            "info",
          );
        }
      },
    },
  ];

  return (
    <DataTable<Role>
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
