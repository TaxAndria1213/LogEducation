import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Periode } from "../../../../../types/models";
import PeriodeService from "../../../../../services/periode.service";
// import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../hooks/useAuth";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function PeriodeList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => PeriodeService, []);

  const columns: ColumnDef<Periode>[] = [
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "annee",
      header: "Année scolaire",
      render: (row) => row.annee?.nom ?? "-",
      sortable: true,
      sortKey: "annee",
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
      }
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
      }
    },
    {
      key: "ordre",
      header: "Ordre",
      accessor: "ordre",
      sortable: true,
      sortKey: "ordre",
    },
  ];

  const actions: RowAction<Periode>[] = [
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
    <DataTable<Periode>
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
        includes: ["annee"],
        where: { annee: { etablissement_id } },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { nom: { contains: text } },
          { annee: { nom: { contains: text } } },
        ],
      })}
    />
  );
}
