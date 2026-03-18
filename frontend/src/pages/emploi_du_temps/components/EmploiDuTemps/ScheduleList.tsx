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
import {
  getCreneauLabel,
  getTeacherDisplayLabel,
  getWeekdayLabel,
} from "../../types";

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
      render: (row) => getTeacherDisplayLabel(row.enseignant),
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
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_50%,_#eef2ff_100%)] px-6 py-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Lignes d'emploi du temps
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Consulte rapidement les affectations de cours, de salles et d'enseignants.
          Les enseignants sont affiches avec leur code et leur identite quand elle est disponible.
        </p>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
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
                  personnel: {
                    include: {
                      utilisateur: {
                        include: {
                          profil: true,
                        },
                      },
                    },
                  },
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
      </section>
    </div>
  );
}
