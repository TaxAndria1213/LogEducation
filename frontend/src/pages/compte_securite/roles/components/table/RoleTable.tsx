import React from "react";
import { faUserPen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import TableTooltip from "../../../../../components/alert/TableTooltip";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import RoleService from "../../../../../services/role.service";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import { styles } from "../../../../../styles/styles";
import type { Role } from "../../../../../types/models";
import { buildAccountCreationUrl } from "../../../../../utils/accountCreationLink";

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
      header: "Cree le",
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
        tableRef.current?.refresh();
      },
    },
    {
      label: "Copier lien de creation",
      render: (row) => (
        <TableTooltip info={`Copier le lien de creation d'utilisateur dans ${row.nom}`}>
          <FontAwesomeIcon icon={faUserPen} color={styles.color.primary} />
        </TableTooltip>
      ),
      onClick: async (row) => {
        try {
          const finalUrl = buildAccountCreationUrl({
            roleId: row.id,
            etablissementId: etablissement_id,
            roleName: row.nom,
          });

          await navigator.clipboard.writeText(finalUrl);
          info(
            `Lien de creation d'utilisateur de ${row.nom} copie dans le presse-papiers.`,
            "info",
          );
        } catch (error) {
          console.warn("Impossible de copier le lien de creation du role.", error);
          info("Impossible de copier le lien de creation de ce role.", "error");
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
      getRowId={(row) => row.id}
      initialQuery={{
        page: 1,
        take: 10,
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
