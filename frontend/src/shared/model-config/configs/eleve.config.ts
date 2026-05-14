import { z } from "zod";
import type { ColumnDef } from "../../table/types";
import type { Eleve } from "../../../types/models";
import type { ModelConfig } from "../types";

export const eleveEditSchema = z.object({
  code_eleve: z.string().trim().max(80).nullable().optional(),
  statut: z
    .enum(["ACTIF", "INACTIF", "SUSPENDU", "ARCHIVE"])
    .nullable()
    .optional(),
  date_entree: z.coerce.date().nullable().optional(),
});

const eleveColumns: ColumnDef<Eleve>[] = [
  {
    key: "code_eleve",
    header: "Code eleve",
    accessor: "code_eleve",
    sortable: true,
    sortKey: "code_eleve",
  },
  {
    key: "statut",
    header: "Statut",
    accessor: "statut",
    sortable: true,
    sortKey: "statut",
  },
  {
    key: "date_entree",
    header: "Date d'entree",
    accessor: "date_entree",
    sortable: true,
    sortKey: "date_entree",
  },
];

export const eleveModelConfig: ModelConfig<Eleve> = {
  modelName: "eleve",
  label: "l'eleve",
  idField: "id",
  api: {
    list: "/api/eleve",
    detail: "/api/eleve/:id",
    update: "/api/eleve/:id",
    updateMethod: "patch",
  },
  table: {
    columns: eleveColumns,
  },
  detail: {
    title: (row) =>
      [
        row.utilisateur?.profil?.prenom,
        row.utilisateur?.profil?.nom,
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || row.code_eleve || "Eleve",
    fields: [
      { key: "code_eleve", label: "Code eleve" },
      { key: "statut", label: "Statut" },
      { key: "date_entree", label: "Date d'entree", type: "date" },
      { key: "utilisateur", label: "Utilisateur", type: "relation" },
      { key: "etablissement", label: "Etablissement", type: "relation" },
    ],
    hiddenKeys: [
      "id",
      "etablissement_id",
      "utilisateur_id",
      "created_at",
      "updated_at",
    ],
  },
  form: {
    schema: eleveEditSchema,
    successMessage: "L'eleve a ete modifie avec succes.",
    fields: [
      {
        name: "code_eleve",
        label: "Code eleve",
        type: "text",
        placeholder: "EX: ELV-2026-001",
      },
      {
        name: "statut",
        label: "Statut",
        type: "enum",
        options: [
          { label: "Actif", value: "ACTIF" },
          { label: "Inactif", value: "INACTIF" },
          { label: "Suspendu", value: "SUSPENDU" },
          { label: "Archive", value: "ARCHIVE" },
        ],
      },
      {
        name: "date_entree",
        label: "Date d'entree",
        type: "date",
      },
    ],
  },
  permissions: {
    canView: true,
    canEdit: true,
  },
};
