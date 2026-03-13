import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { AnneeScolaire } from "../../../../../types/models";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../hooks/useAuth";

export default function AnneeScolaireList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => AnneeScolaireService, []);

  const columns: ColumnDef<AnneeScolaire>[] = [
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "date_debut",
      header: "Début",
      accessor: "date_debut",
      sortable: true,
      sortKey: "date_debut",
      render: (row) => {
        const date = formatDateWithLocalTimezone(row.date_debut.toString());
        return date.date;
      },
    },
    {
      key: "date_fin",
      header: "Fin",
      accessor: "date_fin",
      sortable: true,
      sortKey: "date_fin",
      render: (row) => {
        const date = formatDateWithLocalTimezone(row.date_fin.toString());
        return date.date;
      },
    },
    {
      key: "est_active",
      header: "Etat",
      accessor: "est_active",
      sortable: true,
      sortKey: "est_active",
      render: (row) => {
        return row.est_active ? "En cours" : "Terminée";
      },
    },
  ];

  const actions: RowAction<AnneeScolaire>[] = [
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
        message: "Voulez-vous supprimer cette année scolaire ?",
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
    <DataTable<AnneeScolaire>
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
      })}
    />
  );
}
