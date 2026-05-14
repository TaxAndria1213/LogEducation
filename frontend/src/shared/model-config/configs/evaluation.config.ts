import { z } from "zod";
import type { Evaluation } from "../../../types/models";
import type { ModelConfig } from "../types";
import {
  getCoursDisplayLabel,
  getCoursSecondaryLabel,
} from "../../../services/cours.service";
import { getPedagogicalItemDisplayLabel } from "../../../services/pedagogicalItem.service";
import { getGradingScaleDisplayLabel } from "../../../services/gradingScale.service";

export const evaluationEditSchema = z.object({
  cours_id: z.string().min(1),
  periode_id: z.string().min(1),
  pedagogical_item_id: z.string().nullable().optional(),
  grading_scale_id: z.string().nullable().optional(),
  type_evaluation_id: z.string().nullable().optional(),
  type: z.enum(["DEVOIR", "EXAMEN", "ORAL", "AUTRE"]),
  titre: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  date: z.coerce.date(),
  note_max: z.number().positive(),
  poids: z.number().positive().nullable().optional(),
  est_publiee: z.boolean(),
  include_in_average: z.boolean(),
  show_in_report_card: z.boolean(),
  is_final_exam: z.boolean(),
  cree_par_enseignant_id: z.string().nullable().optional(),
});

export const evaluationModelConfig: ModelConfig<Evaluation> = {
  modelName: "evaluation",
  label: "l'evaluation",
  idField: "id",
  api: {
    list: "/api/evaluation",
    detail: "/api/evaluation/:id",
    update: "/api/evaluation/:id",
    updateMethod: "put",
  },
  table: {
    columns: [],
  },
  detail: {
    fields: [
      { key: "titre", label: "Titre" },
      { key: "type", label: "Type" },
      { key: "cours", label: "Cours", type: "relation" },
      { key: "periode", label: "Periode", type: "relation" },
      { key: "pedagogicalItem", label: "Element pedagogique", type: "relation" },
      { key: "gradingScale", label: "Echelle de notation", type: "relation" },
      { key: "date", label: "Date", type: "date" },
      { key: "note_max", label: "Note max" },
      { key: "poids", label: "Poids" },
      { key: "status", label: "Statut" },
      { key: "include_in_average", label: "Incluse dans la moyenne", type: "boolean" },
      { key: "show_in_report_card", label: "Visible dans le bulletin", type: "boolean" },
      { key: "is_final_exam", label: "Examen final", type: "boolean" },
      { key: "est_publiee", label: "Publiee", type: "boolean" },
    ],
    hiddenKeys: [
      "id",
      "cours_id",
      "periode_id",
      "pedagogical_item_id",
      "grading_scale_id",
      "type_evaluation_id",
      "cree_par_enseignant_id",
      "created_at",
      "updated_at",
    ],
  },
  form: {
    schema: evaluationEditSchema,
    successMessage: "L'evaluation a ete modifiee avec succes.",
    fields: [
      {
        name: "titre",
        label: "Titre",
        type: "text",
        required: true,
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
      },
      {
        name: "cours_id",
        label: "Cours",
        type: "relation-select",
        relation: {
          modelName: "cours",
          labelField: "id",
          valueField: "id",
          endpoint: "/api/cours",
          initialQuery: {
            take: 100,
            includeSpec: {
              annee: true,
              classe: { include: { niveau: true, site: true } },
              matiere: true,
              enseignant: {
                include: {
                  personnel: {
                    include: {
                      utilisateur: {
                        include: { profil: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: [{ created_at: "desc" }],
          },
          getOptionLabel: (row) =>
            `${getCoursDisplayLabel(row as never)}${
              getCoursSecondaryLabel(row as never)
                ? ` - ${getCoursSecondaryLabel(row as never)}`
                : ""
            }`,
        },
      },
      {
        name: "periode_id",
        label: "Periode",
        type: "relation-select",
        relation: {
          modelName: "periode",
          labelField: "nom",
          valueField: "id",
          endpoint: "/api/periode",
          initialQuery: {
            take: 100,
            orderBy: [{ ordre: "asc" }, { date_debut: "asc" }],
          },
        },
      },
      {
        name: "type_evaluation_id",
        label: "Type d'evaluation reference",
        type: "relation-select",
        relation: {
          modelName: "type-evaluation-ref",
          labelField: "nom",
          valueField: "id",
          endpoint: "/api/type-evaluation-ref",
          initialQuery: {
            take: 100,
            where: { is_active: true },
            orderBy: [{ code: "asc" }, { nom: "asc" }],
          },
          getOptionLabel: (row) => {
            const code =
              typeof row.code === "string" && row.code.trim() ? row.code.trim() : "";
            const nom =
              typeof row.nom === "string" && row.nom.trim() ? row.nom.trim() : "";
            return [code, nom].filter(Boolean).join(" - ") || "Type d'evaluation";
          },
        },
      },
      {
        name: "pedagogical_item_id",
        label: "Element pedagogique",
        type: "relation-select",
        relation: {
          modelName: "pedagogical-item",
          labelField: "nom",
          valueField: "id",
          endpoint: "/api/pedagogical-item",
          initialQuery: {
            take: 200,
            includeSpec: {
              parent: true,
              matiere: true,
              niveau: true,
            },
            where: {
              is_active: true,
              is_evaluable: true,
            },
            orderBy: [{ display_order: "asc" }, { nom: "asc" }],
          },
          getOptionLabel: (row) =>
            getPedagogicalItemDisplayLabel(row as never),
        },
      },
      {
        name: "grading_scale_id",
        label: "Echelle de notation",
        type: "relation-select",
        relation: {
          modelName: "grading-scale",
          labelField: "nom",
          valueField: "id",
          endpoint: "/api/grading-scale",
          initialQuery: {
            take: 100,
            where: { is_active: true },
            orderBy: [{ is_default: "desc" }, { nom: "asc" }],
          },
          getOptionLabel: (row) => getGradingScaleDisplayLabel(row as never),
        },
      },
      {
        name: "type",
        label: "Type",
        type: "enum",
        options: [
          { label: "Devoir", value: "DEVOIR" },
          { label: "Examen", value: "EXAMEN" },
          { label: "Oral", value: "ORAL" },
          { label: "Autre", value: "AUTRE" },
        ],
      },
      {
        name: "date",
        label: "Date",
        type: "datetime",
      },
      {
        name: "note_max",
        label: "Note maximale",
        type: "number",
      },
      {
        name: "poids",
        label: "Poids",
        type: "number",
      },
      {
        name: "include_in_average",
        label: "Inclure dans la moyenne",
        type: "boolean",
      },
      {
        name: "show_in_report_card",
        label: "Afficher dans le bulletin",
        type: "boolean",
      },
      {
        name: "is_final_exam",
        label: "Examen final",
        type: "boolean",
      },
      {
        name: "est_publiee",
        label: "Publiee",
        type: "boolean",
      },
    ],
  },
  permissions: {
    canView: true,
    canEdit: true,
  },
};
