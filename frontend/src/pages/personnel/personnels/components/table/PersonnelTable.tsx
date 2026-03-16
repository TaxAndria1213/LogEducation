import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import type { Personnel } from "../../../../../types/models";
import PersonnelService from "../../../../../services/personnel.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";

export default function PersonnelList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new PersonnelService(), []);

  const columns: ColumnDef<Personnel>[] = [
    {
      key: "code_personnel",
      header: "Code",
      render: (row) => row.code_personnel ?? "—",
      sortable: true,
      sortKey: "code_personnel",
    },
    {
      key: "nom",
      header: "Nom",
      render: (row) => row.utilisateur?.profil?.nom ?? "—",
      sortable: true,
      sortKey: "utilisateur.profil.nom",
    },
    {
      key: "prenom",
      header: "Prénom",
      render: (row) => row.utilisateur?.profil?.prenom ?? "—",
      sortable: true,
      sortKey: "utilisateur.profil.prenom",
    },
    {
      key: "poste",
      header: "Poste",
      accessor: "poste",
      sortable: true,
      sortKey: "poste",
    },
    {
      key: "statut",
      header: "Statut",
      accessor: "statut",
      sortable: true,
      sortKey: "statut",
    },
    {
      key: "date_embauche",
      header: "Date d'embauche",
      render: (row) =>
        row.date_embauche
          ? formatDateWithLocalTimezone(row.date_embauche.toString()).date
          : "—",
      sortable: true,
      sortKey: "date_embauche",
    },
  ];

  const actions: RowAction<Personnel>[] = [
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
        message: "Voulez-vous supprimer ce personnel ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<Personnel>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: { utilisateur: { include: { profil: true } } },
        where: { etablissement_id },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        OR: [
          { code_personnel: { contains: text } },
          { poste: { contains: text } },
          { statut: { contains: text } },
        ],
        etablissement_id,
      })}
    />
  );
}
