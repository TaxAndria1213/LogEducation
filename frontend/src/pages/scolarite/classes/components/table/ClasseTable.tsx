import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Classe } from "../../../../../types/models";
import ClasseService from "../../../../../services/classe.service";
import { useAuth } from "../../../../../auth/AuthContext";
// import { useInfo } from "../../../../../hooks/useInfo";

export default function ClasseList() {
  // const { info } = useInfo();
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new ClasseService(), []);

  const columns: ColumnDef<Classe>[] = [
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "niveau",
      header: "Niveau",
      render: (row) => row.niveau?.nom ?? "-",
      sortable: false,
      sortKey: "niveau",
    },
    {
      key: "site",
      header: "Site",
      render: (row) => row.site?.nom ?? "-",
      sortable: false,
      sortKey: "site",
    },
    {
      key: "annee",
      header: "Année scolaire",
      render: (row) => row.annee?.nom ?? "-",
      sortable: false,
      sortKey: "annee",
    },
  ];

  const actions: RowAction<Classe>[] = [
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
    <DataTable<Classe>
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
        includes: ["annee", "site", "niveau"],
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
