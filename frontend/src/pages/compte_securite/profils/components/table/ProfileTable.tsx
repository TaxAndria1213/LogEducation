import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Profil } from "../../../../../types/models";
import ProfileService from "../../../../../services/profile.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";

export default function ProfileList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new ProfileService(), []);

  const columns: ColumnDef<Profil>[] = [
    {
      key: "prenom",
      header: "Prenom",
      accessor: "prenom",
      sortable: true,
      sortKey: "prenom",
    },
    {
      key: "nom",
      header: "Nom",
      accessor: "nom",
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "email",
      header: "Email",
      render: (row) => row.utilisateur?.email ?? "—",
    },
    {
      key: "telephone",
      header: "Telephone",
      render: (row) => row.utilisateur?.telephone ?? "—",
    },
    {
      key: "genre",
      header: "Genre",
      render: (row) => row.genre ?? "—",
      sortable: true,
      sortKey: "genre",
    },
    {
      key: "date_naissance",
      header: "Naissance",
      render: (row) =>
        row.date_naissance
          ? formatDateWithLocalTimezone(row.date_naissance.toString()).date
          : "—",
      sortable: true,
      sortKey: "date_naissance",
    },
  ];

  const actions: RowAction<Profil>[] = [
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
        message: "Voulez-vous supprimer ce profil ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<Profil>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: {
          utilisateur: true,
        },
        where: {
          utilisateur: {
            is: {
              etablissement_id,
            },
          },
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { prenom: { contains: text } },
          { nom: { contains: text } },
          { genre: { contains: text } },
          {
            utilisateur: {
              is: {
                email: { contains: text },
              },
            },
          },
          {
            utilisateur: {
              is: {
                telephone: { contains: text },
              },
            },
          },
        ],
        utilisateur: {
          is: {
            etablissement_id,
          },
        },
      })}
    />
  );
}
