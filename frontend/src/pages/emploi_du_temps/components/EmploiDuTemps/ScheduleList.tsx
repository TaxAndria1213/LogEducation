import React from "react";
import { useAuth } from "../../../../hooks/useAuth";
import { formatDateWithLocalTimezone } from "../../../../app/utils/functions";
import EmploiDuTempsService from "../../../../services/emploiDuTemps.service";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../../shared/table/types";
import type { EmploiDuTemps } from "../../../../types/models";
import { getCreneauLabel, getWeekdayLabel } from "../../types";

export default function ScheduleList() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new EmploiDuTempsService(), []);

  const baseWhere = etablissement_id
    ? {
        classe: {
          etablissement_id,
        },
      }
    : {};

  const columns: ColumnDef<EmploiDuTemps>[] = [
    {
      key: "classe",
      header: "Classe",
      render: (row) => row.classe?.nom ?? row.cours?.classe?.nom ?? "-",
    },
    {
      key: "jour_semaine",
      header: "Jour",
      render: (row) => getWeekdayLabel(row.jour_semaine),
      sortable: true,
      sortKey: "jour_semaine",
    },
    {
      key: "creneau",
      header: "Creneau",
      render: (row) => getCreneauLabel(row.creneau),
    },
    {
      key: "matiere",
      header: "Matiere",
      render: (row) => row.matiere?.nom ?? row.cours?.matiere?.nom ?? "-",
    },
    {
      key: "enseignant",
      header: "Enseignant",
      render: (row) =>
        row.enseignant?.personnel?.code_personnel ??
        row.enseignant?.personnel?.poste ??
        row.enseignant_id ??
        "-",
    },
    {
      key: "salle",
      header: "Salle",
      render: (row) => row.salle?.nom ?? "-",
    },
    {
      key: "effectif_du",
      header: "Actif du",
      render: (row) =>
        row.effectif_du
          ? formatDateWithLocalTimezone(row.effectif_du.toString()).dateHeure
          : "-",
    },
    {
      key: "effectif_au",
      header: "Actif au",
      render: (row) =>
        row.effectif_au
          ? formatDateWithLocalTimezone(row.effectif_au.toString()).dateHeure
          : "-",
    },
  ];

  const actions: RowAction<EmploiDuTemps>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => console.log("emploi_du_temps", row.id),
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer cette ligne d'emploi du temps ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<EmploiDuTemps>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(row) => row.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: baseWhere,
        includeSpec: {
          classe: true,
          cours: {
            include: {
              classe: true,
              matiere: true,
            },
          },
          matiere: true,
          enseignant: {
            include: {
              personnel: true,
            },
          },
          salle: {
            include: {
              site: true,
            },
          },
          creneau: true,
        },
        orderBy: [{ jour_semaine: "asc" }, { creneau_horaire_id: "asc" }],
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          baseWhere,
          {
            OR: [
              { classe: { nom: { contains: text } } },
              { cours: { classe: { nom: { contains: text } } } },
              { matiere: { nom: { contains: text } } },
              { cours: { matiere: { nom: { contains: text } } } },
              { salle: { nom: { contains: text } } },
              { creneau: { nom: { contains: text } } },
            ],
          },
        ],
      })}
    />
  );
}
