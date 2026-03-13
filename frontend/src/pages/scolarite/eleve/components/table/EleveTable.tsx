import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Eleve } from "../../../../../types/models";
import EleveService from "../../../../../services/eleve.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
// import { useInfo } from "../../../../../hooks/useInfo";

export default function EleveList() {
  // const { info } = useInfo();
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new EleveService(), []);

  const columns: ColumnDef<Eleve>[] = [
    {
      key: "code_eleve",
      header: "Code élève",
      render: (row) => row.code_eleve ?? "—",
      sortable: true,
      sortKey: "code_eleve",
    },
    
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
      render: (row) => row.utilisateur?.profil?.nom ?? "—", 
    },
    {
      key: "prenom",
      header: "Prénom",
      accessor: "prenom",
      sortable: true,
      sortKey: "prenom",
      render: (row) => row.utilisateur?.profil?.prenom ?? "—", 
    },
    {
      key: "date_entree",
      header: "Date d'entrée",
      render: (row) =>
        row.date_entree
          ? formatDateWithLocalTimezone(row.date_entree.toString()).date
          : "—",
      sortable: true,
      sortKey: "date_entree",
    },
    {
      key: "statut",
      header: "Statut",
      accessor: "statut",
      sortable: true,
      sortKey: "statut",
    },
  ];

  const actions: RowAction<Eleve>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => {
        console.log("voir", row);
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
    <DataTable<Eleve>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        // Exemple: includes relationnelles
        includeSpec: {
          utilisateur: {
            include: { profil: true },
          }
        },
        where: { etablissement_id },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { code_eleve: { contains: text } },
          { statut: { contains: text } },
        ],
        etablissement_id,
      })}
    />
  );
}
