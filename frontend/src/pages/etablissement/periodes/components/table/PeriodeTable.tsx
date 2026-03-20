import React from "react";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../hooks/useAuth";
import PeriodeService from "../../../../../services/periode.service";
import { DataTable, type DataTableHandle } from "../../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import type { Periode } from "../../../../../types/models";

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
      header: "Annee scolaire",
      render: (row) => row.annee?.nom ?? "-",
      sortable: true,
      sortKey: "annee",
    },
    {
      key: "date_debut",
      header: "Debut",
      accessor: "date_debut",
      sortable: true,
      sortKey: "date_debut",
      render: (row) => formatDateWithLocalTimezone(row.date_debut.toString()).date,
    },
    {
      key: "date_fin",
      header: "Fin",
      accessor: "date_fin",
      sortable: true,
      sortKey: "date_fin",
      render: (row) => formatDateWithLocalTimezone(row.date_fin.toString()).date,
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
        message: "Voulez-vous supprimer cette periode ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
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
        includes: ["annee"],
        where: { annee: { etablissement_id } },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [{ nom: { contains: text } }, { annee: { nom: { contains: text } } }],
      })}
    />
  );
}
