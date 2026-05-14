import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import ProgrammeService, {
  getProgrammeDisplayLabel,
  getProgrammeMatiereSummary,
  type ProgrammeWithRelations,
} from "../../../../../services/programme.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useProgrammeStore } from "../../store/ProgrammeIndexStore";
import { useProgrammeCreateStore } from "../../store/ProgrammeCreateStore";

function getStatusBadgeClass(status?: string | null) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700";
    case "IN_REVISION":
      return "bg-amber-100 text-amber-700";
    case "LOCKED":
      return "bg-rose-100 text-rose-700";
    case "ARCHIVED":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-sky-100 text-sky-700";
  }
}

export default function ProgrammeTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new ProgrammeService(), []);
  const setRenderState = useProgrammeStore((state) => state.setRenderState);
  const setRenderedComponent = useProgrammeStore((state) => state.setRenderedComponent);
  const setInitialData = useProgrammeCreateStore((state) => state.setInitialData);

  const openProgrammeEditor = React.useCallback(
    (row: ProgrammeWithRelations) => {
      setInitialData({
        ...row,
        matieres: (row.matieres ?? []).map((line) => ({
          id: line.id,
          matiere_id: line.matiere_id,
          heures_semaine: line.heures_semaine ?? null,
          heures_annuelles: line.heures_annuelles ?? null,
          seances_par_semaine: line.seances_par_semaine ?? null,
          duree_seance_par_defaut: line.duree_seance_par_defaut ?? null,
          coefficient: line.coefficient ?? null,
          est_obligatoire: line.est_obligatoire ?? true,
          est_visible_bulletin: line.est_visible_bulletin ?? true,
          inclure_moyenne_generale: line.inclure_moyenne_generale ?? true,
          appreciation_obligatoire: line.appreciation_obligatoire ?? false,
          libelle_bulletin: line.libelle_bulletin ?? null,
          ordre_affichage_bulletin: line.ordre_affichage_bulletin ?? null,
          grading_scale_id: line.grading_scale_id ?? null,
          mode_calcul: line.mode_calcul ?? "WEIGHTED_AVERAGE",
          statut: line.statut ?? "ACTIVE",
        })),
      });
      setRenderState(3);
      setRenderedComponent("add");
    },
    [setInitialData, setRenderedComponent, setRenderState],
  );

  const columns: ColumnDef<ProgrammeWithRelations>[] = [
    {
      key: "nom",
      header: "Programme",
      render: (row) => getProgrammeDisplayLabel(row),
      sortable: true,
      sortKey: "nom",
    },
    {
      key: "annee",
      header: "Annee scolaire",
      render: (row) => row.annee?.nom ?? "-",
      sortable: true,
      sortKey: "annee.nom",
    },
    {
      key: "niveau",
      header: "Niveau",
      render: (row) => row.niveau?.nom ?? "-",
      sortable: true,
      sortKey: "niveau.nom",
    },
    {
      key: "statut",
      header: "Statut",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(row.statut)}`}
        >
          {row.statut ?? "DRAFT"}
        </span>
      ),
      sortable: true,
      sortKey: "statut",
    },
    {
      key: "matieres_count",
      header: "Matieres",
      render: (row) => String(row.matieres?.length ?? 0),
    },
    {
      key: "matieres_preview",
      header: "Apercu",
      render: (row) => getProgrammeMatiereSummary(row.matieres),
    },
    {
      key: "created_at",
      header: "Cree le",
      render: (row) =>
        formatDateWithLocalTimezone(row.created_at.toString()).date,
      sortable: true,
      sortKey: "created_at",
    },
  ];

  const actions: RowAction<ProgrammeWithRelations>[] = [
    {
      label: "Modifier",
      kind: "edit",
      variant: "primary",
      onClick: openProgrammeEditor,
    },
    {
      label: "Supprimer",
      variant: "danger",
      confirm: {
        title: "Suppression",
        message: "Supprimer ce programme et ses lignes de matieres ?",
      },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<ProgrammeWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      getRowId={(r) => r.id}
      detailView={{
        mode: "replace",
        editStrategy: "custom",
        title: "Details du programme",
        getTitle: (row) => getProgrammeDisplayLabel(row),
        onEdit: openProgrammeEditor,
      }}
      initialQuery={{
        page: 1,
        take: 10,
        includeSpec: {
          annee: true,
          niveau: true,
          defaultGradingScale: true,
          matieres: {
            include: {
              matiere: {
                include: {
                  departement: true,
                },
              },
              gradingScale: true,
            },
          },
        },
        where: etablissement_id ? { etablissement_id } : {},
        orderBy: [{ created_at: "desc" }],
      }}
      showSearch
      onSearchBuildWhere={(text) => {
        const searchFilters = {
          OR: [
            { nom: { contains: text } },
            { annee: { nom: { contains: text } } },
            { niveau: { nom: { contains: text } } },
            {
              matieres: {
                some: {
                  matiere: {
                    nom: { contains: text },
                  },
                },
              },
            },
          ],
        };

        if (!etablissement_id) {
          return searchFilters;
        }

        return {
          AND: [searchFilters, { etablissement_id }],
        };
      }}
    />
  );
}
