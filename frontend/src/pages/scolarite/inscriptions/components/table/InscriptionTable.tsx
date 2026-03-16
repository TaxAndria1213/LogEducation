/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Inscription } from "../../../../../types/models";
import InscriptionService from "../../../../../services/inscription.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";

export default function InscriptionList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new InscriptionService(), []);

  const columns: ColumnDef<Inscription>[] = [
    {
      key: "code_eleve",
      header: "Code élève",
      render: (row: any) => row.eleve?.code_eleve ?? "—",
      sortable: false,
      sortKey: "eleve.code_eleve",
    },
    {
      key: "classe",
      header: "Classe",
      render: (row: any) => row.classe?.nom ?? "—",
      sortable: false,
      sortKey: "classe.nom",
    },
    {
      key: "annee",
      header: "Année scolaire",
      render: (row: any) => row.annee?.nom ?? "—",
      sortable: false,
      sortKey: "annee.nom",
    },
    {
      key: "statut",
      header: "Statut",
      accessor: "statut",
      sortable: true,
      sortKey: "statut",
    },
    {
      key: "created_at",
      header: "Inscrit le",
      accessor: "date_inscription",
      sortable: true,
      sortKey: "date_inscription",
      render: (row) => {
        const date = formatDateWithLocalTimezone(row.date_inscription.toString());
        return date.date;
      },
    },
  ];

  const actions: RowAction<Inscription>[] = [
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
    <DataTable<Inscription>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: {
          eleve: true,
          classe: true,
          annee: true,
        },
        where: { annee: { etablissement_id } },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { eleve: { code_eleve: { contains: text } } },
          { classe: { nom: { contains: text } } },
          { annee: { nom: { contains: text } } },
        ],
        annee: { etablissement_id },
      })}
    />
  );
}
