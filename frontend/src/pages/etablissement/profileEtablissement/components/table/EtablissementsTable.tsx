import React from "react";
import EtablissementService from "../../../../../services/etablissement.service";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Etablissement } from "../../../../../types/models";
import TableTooltip from "../../../../../components/alert/TableTooltip";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function EtablissementList() {
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new EtablissementService(), []);

  const columns: ColumnDef<Etablissement>[] = [
    {
      key: "code",
      header: "Code",
      accessor: "code",
      sortable: true,
      sortKey: "code",
    },
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
      render: (row) => <TableTooltip info={row.nom as string} />,
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
    {
      key: "fuseau_horaire",
      header: "Fuseau horaire",
      accessor: "fuseau_horaire",
      sortable: true,
      sortKey: "fuseau_horaire",
    },
  ];

  const actions: RowAction<Etablissement>[] = [
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
        message: "Voulez-vous supprimer cet établissement ?",
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
    <DataTable<Etablissement>
      ref={tableRef}
      title="Liste des établissements"
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        // Exemple: includes relationnelles
        // includeAll: true,
        // includes: ["user", "items", "items.product"],
        // where: { deleted_at: null }
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [{ code: { contains: text } }, { nom: { contains: text } }],
      })}
    />
  );
}
