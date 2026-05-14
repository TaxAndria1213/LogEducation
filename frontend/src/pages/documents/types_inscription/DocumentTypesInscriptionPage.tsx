/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiRefreshCcw } from "react-icons/fi";
import ERPPage from "../../../components/page/ERPPage";
import { hasAccess } from "../../../components/components.build";
import { FieldWrapper } from "../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../components/Form/fields/inputStyles";
import { useInfo } from "../../../hooks/useInfo";
import { useAuth } from "../../../hooks/useAuth";
import DocumentTypeInscriptionService from "../../../services/documentTypeInscription.service";
import {
  DataTable,
  type DataTableHandle,
} from "../../../shared/table/DataTable";
import type { ColumnDef, RowAction } from "../../../shared/table/types";
import type { DocumentTypeInscription } from "../../../types/models";
import NotFound from "../../NotFound";

type FormState = {
  code: string;
  nom: string;
  description: string;
  ordre: string;
  est_obligatoire_par_defaut: boolean;
  est_actif: boolean;
  appliquer_a_tous: boolean;
  types_selectionnes: string[];
};

const INSCRIPTION_TYPE_OPTIONS = [
  { value: "NOUVELLE_INSCRIPTION", label: "Nouvelle inscription" },
  { value: "REINSCRIPTION", label: "Reinscription" },
  { value: "TRANSFERT_ENTRANT", label: "Transfert entrant" },
  { value: "REDOUBLEMENT", label: "Redoublement" },
  {
    value: "PASSAGE_CLASSE_SUPERIEURE",
    label: "Passage en classe superieure",
  },
] as const;

const EMPTY_FORM: FormState = {
  code: "",
  nom: "",
  description: "",
  ordre: "",
  est_obligatoire_par_defaut: false,
  est_actif: true,
  appliquer_a_tous: true,
  types_selectionnes: [],
};

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return "La configuration des documents n'a pas pu etre enregistree.";
}

function extractInscriptionTypes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim().toUpperCase())
    .filter(Boolean);
}

function toFormState(item: DocumentTypeInscription | null): FormState {
  if (!item) {
    return { ...EMPTY_FORM };
  }

  const types = extractInscriptionTypes(item.type_inscriptions_json);

  return {
    code: item.code ?? "",
    nom: item.nom ?? "",
    description: item.description ?? "",
    ordre:
      typeof item.ordre === "number" && Number.isFinite(item.ordre)
        ? String(item.ordre)
        : "",
    est_obligatoire_par_defaut: Boolean(item.est_obligatoire_par_defaut),
    est_actif: Boolean(item.est_actif),
    appliquer_a_tous: types.length === 0,
    types_selectionnes: types,
  };
}

function formatTypeLabel(value: string) {
  return (
    INSCRIPTION_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
    value
  );
}

export default function DocumentTypesInscriptionPage() {
  const { etablissement_id, user, roles } = useAuth();
  const { info } = useInfo();
  const tableRef = React.useRef<DataTableHandle>(null);
  const service = useMemo(() => new DocumentTypeInscriptionService(), []);
  const [editingItem, setEditingItem] =
    useState<DocumentTypeInscription | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  const canAccessPage = useMemo(() => {
    if (!user || !roles) return false;
    return hasAccess(user, roles, "DOC.INSCRIPTIONTYPES.PAGE");
  }, [roles, user]);

  const canManage = useMemo(() => {
    if (!user || !roles) return false;
    return hasAccess(user, roles, "DOC.INSCRIPTIONTYPES.MANAGE");
  }, [roles, user]);

  const resetForm = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
  };

  const openCreate = () => {
    resetForm();
  };

  const openEdit = (item: DocumentTypeInscription) => {
    setEditingItem(item);
    setForm(toFormState(item));
  };

  const toggleTypeSelection = (value: string) => {
    setForm((current) => ({
      ...current,
      types_selectionnes: current.types_selectionnes.includes(value)
        ? current.types_selectionnes.filter((item) => item !== value)
        : [...current.types_selectionnes, value],
    }));
  };

  const saveForm = async () => {
    if (!etablissement_id) {
      info("Aucun etablissement actif n'est selectionne.", "error");
      return;
    }

    if (!form.code.trim()) {
      info("Le code du document est obligatoire.", "error");
      return;
    }

    if (!form.nom.trim()) {
      info("Le nom du document est obligatoire.", "error");
      return;
    }

    if (!form.appliquer_a_tous && form.types_selectionnes.length === 0) {
      info(
        "Selectionne au moins un type d'inscription ou applique le document a tous.",
        "error",
      );
      return;
    }

    const payload = {
      code: form.code,
      nom: form.nom,
      description: form.description || null,
      ordre: form.ordre.trim() ? Number(form.ordre) : null,
      est_obligatoire_par_defaut: form.est_obligatoire_par_defaut,
      est_actif: form.est_actif,
      type_inscriptions_json: form.appliquer_a_tous
        ? null
        : form.types_selectionnes,
    };

    setSubmitting(true);
    try {
      if (editingItem) {
        await service.update(editingItem.id, payload);
        info("Type de document mis a jour avec succes.", "success");
      } else {
        await service.create(payload);
        info("Type de document cree avec succes.", "success");
      }

      resetForm();
      tableRef.current?.refresh();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<DocumentTypeInscription>[] = [
    {
      key: "nom",
      header: "Document",
      sortable: true,
      sortKey: "nom",
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{row.nom}</p>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                row.etablissement_id
                  ? "bg-sky-50 text-sky-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {row.etablissement_id ? "Etablissement" : "Global"}
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                row.est_actif
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {row.est_actif ? "Actif" : "Inactif"}
            </span>
          </div>
          <p className="text-xs text-slate-500">{row.code}</p>
          {row.description ? (
            <p className="text-xs text-slate-500">{row.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "type_inscriptions_json",
      header: "Types d'inscription",
      render: (row) => {
        const types = extractInscriptionTypes(row.type_inscriptions_json);
        if (types.length === 0) {
          return <span className="text-sm text-slate-500">Tous les types</span>;
        }

        return (
          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <span
                key={type}
                className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
              >
                {formatTypeLabel(type)}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "est_obligatoire_par_defaut",
      header: "Obligatoire",
      sortable: true,
      sortKey: "est_obligatoire_par_defaut",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            row.est_obligatoire_par_defaut
              ? "bg-rose-50 text-rose-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {row.est_obligatoire_par_defaut ? "Oui" : "Non"}
        </span>
      ),
    },
    {
      key: "ordre",
      header: "Ordre",
      sortable: true,
      sortKey: "ordre",
      render: (row) => row.ordre ?? "-",
    },
  ];

  const actions: RowAction<DocumentTypeInscription>[] = [
    {
      label: "Modifier",
      variant: "secondary",
      show: (row) => canManage && row.etablissement_id === etablissement_id,
      onClick: (row) => openEdit(row),
    },
    {
      label: "Cloner",
      variant: "secondary",
      show: (row) => canManage && !row.etablissement_id && Boolean(etablissement_id),
      onClick: async (row) => {
        try {
          await service.clone(row.id);
          info("Type de document clone avec succes.", "success");
          tableRef.current?.refresh();
        } catch (error) {
          info(getErrorMessage(error), "error");
        }
      },
    },
    {
      label: "Activer/Desactiver",
      variant: "secondary",
      show: (row) => canManage && row.etablissement_id === etablissement_id,
      onClick: async (row) => {
        try {
          await service.update(row.id, {
            code: row.code,
            nom: row.nom,
            description: row.description ?? null,
            ordre: row.ordre ?? null,
            est_obligatoire_par_defaut: row.est_obligatoire_par_defaut,
            est_actif: !row.est_actif,
            type_inscriptions_json: extractInscriptionTypes(
              row.type_inscriptions_json,
            ),
          });
          info("Statut du document mis a jour.", "success");
          tableRef.current?.refresh();
        } catch (error) {
          info(getErrorMessage(error), "error");
        }
      },
    },
    {
      label: "Supprimer",
      variant: "danger",
      show: (row) => canManage && row.etablissement_id === etablissement_id,
      confirm: {
        title: "Suppression",
        message: "Supprimer ce type de document ?",
      },
      onClick: async (row) => {
        try {
          await service.delete(row.id);
          if (editingItem?.id === row.id) {
            resetForm();
          }
          info("Type de document supprime avec succes.", "success");
          tableRef.current?.refresh();
        } catch (error) {
          info(getErrorMessage(error), "error");
        }
      },
    },
  ];

  if (!canAccessPage) {
    return <NotFound />;
  }

  return (
    <ERPPage
      title="Types de documents d'inscription"
      description="Configurer les pieces demandees pendant l'inscription et le resume du dossier."
      headerActions={canManage ? [
        <button
          key="refresh-document-types"
          type="button"
          onClick={() => tableRef.current?.refresh()}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <FiRefreshCcw className="h-4 w-4" />
          Actualiser
        </button>,
        <button
          key="new-document-type"
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <FiPlus className="h-4 w-4" />
          Nouveau type
        </button>,
      ] : []}
    >
      <div className="space-y-5">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">
            Les types <span className="font-semibold text-slate-900">globaux</span>{" "}
            servent de modele. Les types{" "}
            <span className="font-semibold text-slate-900">
              etablissements
            </span>{" "}
            sont ceux que tu peux modifier ici. Si un modele global te convient,
            utilise <span className="font-semibold text-slate-900">Cloner</span>{" "}
            pour l'adapter a ton etablissement.
          </p>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <DataTable<DocumentTypeInscription>
              ref={tableRef}
              service={service}
              columns={columns}
              actions={actions}
              getRowId={(row) => row.id}
              initialQuery={{
                page: 1,
                take: 20,
                orderBy: [{ ordre: "asc" }, { nom: "asc" }],
              }}
              showSearch
              onSearchBuildWhere={(text) => ({
                OR: [
                  { nom: { contains: text } },
                  { code: { contains: text } },
                  { description: { contains: text } },
                ],
              })}
              // mapResponse={(raw) => {
              //   const payload = raw?.data?.data ?? raw?.data ?? raw;
              //   const rows = (payload?.data ?? []) as DocumentTypeInscription[];
              //   return {
              //     data: rows,
              //     meta: payload?.meta ?? {
              //       take: 20,
              //       hasNextPage: false,
              //     },
              //   };
              // }}
            />
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingItem ? "Modifier le type" : "Nouveau type"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingItem
                    ? "Met a jour un type propre a ton etablissement."
                    : "Creer un type de document specifique a ton etablissement."}
                </p>
              </div>
              {editingItem ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Annuler
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4">
              <FieldWrapper
                id="document-type-code"
                label="Code"
                required
                description="Identifiant stable utilise par le moteur d'inscription."
              >
                <input
                  id="document-type-code"
                  value={form.code}
                  disabled={!canManage}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  placeholder="ACTE_NAISSANCE"
                  className={getInputClassName(false)}
                />
              </FieldWrapper>

              <FieldWrapper
                id="document-type-nom"
                label="Nom"
                required
              >
                <input
                  id="document-type-nom"
                  value={form.nom}
                  disabled={!canManage}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nom: event.target.value,
                    }))
                  }
                  placeholder="Acte de naissance"
                  className={getInputClassName(false)}
                />
              </FieldWrapper>

              <FieldWrapper
                id="document-type-description"
                label="Description"
              >
                <textarea
                  id="document-type-description"
                  value={form.description}
                  disabled={!canManage}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Document d'etat civil pour les nouvelles inscriptions"
                  className={`${getInputClassName(false)} min-h-24 resize-y`}
                />
              </FieldWrapper>

              <FieldWrapper
                id="document-type-ordre"
                label="Ordre d'affichage"
                description="Plus petit = plus haut dans le formulaire."
              >
                <input
                  id="document-type-ordre"
                  type="number"
                  value={form.ordre}
                  disabled={!canManage}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ordre: event.target.value,
                    }))
                  }
                  className={getInputClassName(false)}
                />
              </FieldWrapper>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.est_obligatoire_par_defaut}
                    disabled={!canManage}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        est_obligatoire_par_defaut: event.target.checked,
                      }))
                    }
                  />
                  Obligatoire par defaut
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.est_actif}
                    disabled={!canManage}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        est_actif: event.target.checked,
                      }))
                    }
                  />
                  Type actif
                </label>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={form.appliquer_a_tous}
                    disabled={!canManage}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        appliquer_a_tous: event.target.checked,
                        types_selectionnes: event.target.checked
                          ? []
                          : current.types_selectionnes,
                      }))
                    }
                  />
                  Appliquer ce document a tous les types d'inscription
                </label>

                {!form.appliquer_a_tous ? (
                  <div className="mt-4 grid gap-2">
                    {INSCRIPTION_TYPE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={form.types_selectionnes.includes(option.value)}
                          disabled={!canManage}
                          onChange={() => toggleTypeSelection(option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    Le document sera propose quel que soit le type
                    d'inscription.
                  </p>
                )}
              </div>

              {canManage ? (
                <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <FiRefreshCcw className="h-4 w-4" />
                  Reinitialiser
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void saveForm()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editingItem ? (
                    <FiEdit2 className="h-4 w-4" />
                  ) : (
                    <FiPlus className="h-4 w-4" />
                  )}
                  {submitting
                    ? "Enregistrement..."
                    : editingItem
                      ? "Mettre a jour"
                      : "Creer le type"}
                </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Cette page est en lecture seule pour ton profil.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </ERPPage>
  );
}
