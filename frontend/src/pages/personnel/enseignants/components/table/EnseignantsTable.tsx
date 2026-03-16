import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Enseignant } from "../../../../../types/models";
import EnseignantService from "../../../../../services/enseignant.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";

export default function EnseignantsList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new EnseignantService(), []);

  const columns: ColumnDef<Enseignant>[] = [
    {
      key: "personnel",
      header: "Code personnel",
      render: (row) => row.personnel?.code_personnel ?? "—",
      sortable: true,
      sortKey: "personnel.code_personnel",
    },
    {
      key: "nom",
      header: "Nom",
      render: (row) => row.personnel?.utilisateur?.profil?.nom ?? "—",
      sortable: true,
      sortKey: "personnel.utilisateur.profil.nom",
    },
    {
      key: "prenom",
      header: "Prénom",
      render: (row) => row.personnel?.utilisateur?.profil?.prenom ?? "—",
      sortable: true,
      sortKey: "personnel.utilisateur.profil.prenom",
    },
    {
      key: "departement",
      header: "Département principal",
      render: (row) => row.departement?.nom ?? "—",
      sortable: true,
      sortKey: "departement.nom",
    },
    {
      key: "created_at",
      header: "Créé le",
      render: (row) =>
        formatDateWithLocalTimezone(row.created_at.toString()).date,
      sortable: true,
      sortKey: "created_at",
    },
  ];

  const actions: RowAction<Enseignant>[] = [
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
        message: "Voulez-vous supprimer cet enseignant ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<Enseignant>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: {
          personnel: {
            include: { utilisateur: { include: { profil: true } } },
          },
          departement: true,
        },
        where: etablissement_id ? { personnel: { etablissement_id } } : {},
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { personnel: { code_personnel: { contains: text } } },
          { departement: { nom: { contains: text } } },
        ],
        ...(etablissement_id
          ? { personnel: { etablissement_id } }
          : {}),
      })}
    />
  );
}
