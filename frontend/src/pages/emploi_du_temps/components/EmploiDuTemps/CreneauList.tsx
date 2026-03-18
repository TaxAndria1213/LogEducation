import React, { useEffect } from "react";
import { useAuth } from "../../../../hooks/useAuth";
import CreneauHoraireService from "../../../../services/creneauHoraire.service";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../shared/table/types";
import type { CreneauHoraire } from "../../../../types/models";

type Props = {
  refreshToken?: number;
};

export default function CreneauList({ refreshToken = 0 }: Props) {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new CreneauHoraireService(), []);

  const baseWhere = etablissement_id ? { etablissement_id } : {};

  useEffect(() => {
    if (refreshToken > 0) {
      tableRef.current?.refresh();
    }
  }, [refreshToken]);

  const columns: ColumnDef<CreneauHoraire>[] = [
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "heure_debut",
      header: "Debut",
      accessor: "heure_debut",
      sortable: true,
      sortKey: "heure_debut",
    },
    {
      key: "heure_fin",
      header: "Fin",
      accessor: "heure_fin",
      sortable: true,
      sortKey: "heure_fin",
    },
    {
      key: "ordre",
      header: "Ordre",
      accessor: "ordre",
      sortable: true,
      sortKey: "ordre",
    },
  ];

  const actions: RowAction<CreneauHoraire>[] = [
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer ce creneau horaire ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<CreneauHoraire>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: baseWhere,
        orderBy: [{ ordre: "asc" }, { heure_debut: "asc" }],
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          baseWhere,
          {
            OR: [
              { nom: { contains: text } },
              { heure_debut: { contains: text } },
              { heure_fin: { contains: text } },
            ],
          },
        ],
      })}
    />
  );
}
