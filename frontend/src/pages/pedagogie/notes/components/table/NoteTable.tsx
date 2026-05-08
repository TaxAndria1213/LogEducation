import React from "react";
import type { ColumnDef, RowAction } from "../../../../../shared/table/types";
import {
  DataTable,
  type DataTableHandle,
} from "../../../../../shared/table/DataTable";
import AssessmentResultService, {
  getAssessmentResultDisplayLabel,
  getAssessmentResultPercentage,
  getAssessmentResultStatusLabel,
  type AssessmentResultWithRelations,
} from "../../../../../services/assessmentResult.service";
import { getEleveDisplayLabel } from "../../../../../services/note.service";
import { getEvaluationDisplayLabel } from "../../../../../services/evaluation.service";
import { formatDateWithLocalTimezone } from "../../../../../app/utils/functions";
import { useAuth } from "../../../../../auth/AuthContext";

export default function NoteTable() {
  const { etablissement_id } = useAuth();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = React.useMemo(() => new AssessmentResultService(), []);

  const columns: ColumnDef<AssessmentResultWithRelations>[] = [
    {
      key: "student",
      header: "Eleve",
      render: (row) => getEleveDisplayLabel(row.student),
      sortable: false,
      sortKey: "student.code_eleve",
    },
    {
      key: "assessment",
      header: "Evaluation",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{getEvaluationDisplayLabel(row.assessment)}</p>
          <p className="text-xs text-slate-500">
            {row.assessment?.cours?.classe?.nom?.trim() || "Classe non renseignee"}
          </p>
        </div>
      ),
      sortable: false,
      sortKey: "assessment.titre",
    },
    {
      key: "resultat",
      header: "Resultat",
      render: (row) => {
        const percentage = getAssessmentResultPercentage(row);
        return (
          <div className="space-y-1 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {getAssessmentResultDisplayLabel(row)}
            </p>
            <p className="text-xs text-slate-500">
              {percentage !== null ? `${percentage}%` : "Non calcule"}
            </p>
          </div>
        );
      },
      sortable: false,
      sortKey: "updated_at",
    },
    {
      key: "status",
      header: "Statut",
      render: (row) => getAssessmentResultStatusLabel(row.status),
      sortable: false,
      sortKey: "status",
    },
    {
      key: "validation",
      header: "Validation",
      render: (row) => (row.is_validated ? "Valide" : "Brouillon"),
      sortable: false,
      sortKey: "is_validated",
    },
    {
      key: "observation",
      header: "Commentaire",
      render: (row) => row.observation?.trim() || "-",
      sortable: false,
    },
    {
      key: "updated_at",
      header: "Saisi le",
      render: (row) =>
        row.validated_at
          ? formatDateWithLocalTimezone(row.validated_at.toString()).dateHeure
          : formatDateWithLocalTimezone(row.updated_at.toString()).dateHeure,
      sortable: false,
      sortKey: "updated_at",
    },
  ];

  const actions: RowAction<AssessmentResultWithRelations>[] = [
    {
      label: "Voir",
      variant: "secondary",
      onClick: (row) => console.log("voir", row),
    },
    {
      label: "Valider",
      variant: "primary",
      show: (row) => !row.is_validated,
      confirm: {
        title: "Validation",
        message: "Valider ce resultat et le verrouiller pour les modifications standards ?",
      },
      onClick: async (row) => {
        await service.validate(row.id);
        tableRef.current?.refresh();
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      show: (row) => !row.is_validated,
      confirm: { title: "Suppression", message: "Supprimer ce resultat ?" },
      onClick: async (row) => {
        await service.delete(row.id);
        tableRef.current?.refresh();
      },
    },
  ];

  return (
    <DataTable<AssessmentResultWithRelations>
      ref={tableRef}
      service={service}
      columns={columns}
      actions={actions}
      detailView={{
        mode: "below",
        title: "Detail du resultat",
        getTitle: (row) => getAssessmentResultDisplayLabel(row),
        fieldLabels: {
          assessment_id: "Evaluation",
          student_id: "Eleve",
          raw_score: "Score brut",
          max_score: "Note maximale",
          normalized_score: "Score normalise",
          scale_level_id: "Niveau",
          text_value: "Valeur descriptive",
          display_value: "Valeur affichee",
          status: "Statut",
          observation: "Observation",
          is_validated: "Valide",
          validated_at: "Valide le",
          validated_by: "Valide par",
          changed_at: "Modifie le",
          changed_by: "Modifie par",
          old_display_value: "Ancienne valeur",
          new_display_value: "Nouvelle valeur",
          old_status: "Ancien statut",
          new_status: "Nouveau statut",
          history: "Historique",
          assessment: "Evaluation",
          student: "Eleve",
          scaleLevel: "Niveau",
        },
      }}
      getRowId={(r) => r.id}
      initialQuery={{
        page: 1,
        take: 10,
        where: etablissement_id
          ? {
              student: {
                etablissement_id,
              },
            }
          : {},
        includeSpec: {
          assessment: {
            include: {
              periode: true,
              gradingScale: {
                include: {
                  levels: true,
                },
              },
              cours: {
                include: {
                  annee: true,
                  matiere: true,
                  classe: true,
                },
              },
            },
          },
          student: {
            include: {
              utilisateur: {
                include: {
                  profil: true,
                },
              },
            },
          },
          scaleLevel: true,
        },
      }}
      showSearch
      onSearchBuildWhere={(text) => ({
        AND: [
          ...(etablissement_id
            ? [
                {
                  student: {
                    etablissement_id,
                  },
                },
              ]
            : []),
          {
            OR: [
              { student: { code_eleve: { contains: text } } },
              { student: { utilisateur: { profil: { prenom: { contains: text } } } } },
              { student: { utilisateur: { profil: { nom: { contains: text } } } } },
              { assessment: { titre: { contains: text } } },
              { assessment: { cours: { matiere: { nom: { contains: text } } } } },
              { assessment: { cours: { classe: { nom: { contains: text } } } } },
              { display_value: { contains: text } },
              { observation: { contains: text } },
            ],
          },
        ],
      })}
    />
  );
}
