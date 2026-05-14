import { useEffect, useMemo, useState } from "react";
import {
  FiEdit2,
  FiGitBranch,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";
import ERPPage from "../../../components/page/ERPPage";
import Spin from "../../../components/anim/Spin";
import { useAuth } from "../../../hooks/useAuth";
import { useInfo } from "../../../hooks/useInfo";
import anneeScolaireService from "../../../services/anneeScolaire.service";
import MatiereService, {
  getMatiereDisplayLabel,
  type MatiereWithRelations,
} from "../../../services/matiere.service";
import NiveauScolaireService from "../../../services/niveau.service";
import PedagogicalItemService, {
  getPedagogicalItemTypeLabel,
  type PedagogicalItemWithRelations,
} from "../../../services/pedagogicalItem.service";
import type {
  AnneeScolaire,
  NiveauScolaire,
  PedagogicalCalculationMode,
  PedagogicalItemType,
} from "../../../types/models";

type PedagogicalTreeNode = PedagogicalItemWithRelations & {
  enfants?: PedagogicalTreeNode[];
};

type FormState = {
  id?: string;
  niveau_scolaire_id: string;
  parent_id: string;
  matiere_id: string;
  item_type: PedagogicalItemType;
  code: string;
  nom: string;
  description: string;
  display_order: string;
  coefficient: string;
  weight: string;
  is_evaluable: boolean;
  is_visible_on_report: boolean;
  is_required: boolean;
  calculation_mode: PedagogicalCalculationMode;
  is_active: boolean;
};

const ITEM_TYPES: PedagogicalItemType[] = [
  "SUBJECT",
  "GROUP",
  "DOMAIN",
  "SUBDOMAIN",
  "COMPETENCY",
  "OBJECTIVE",
];

const CALCULATION_MODES: PedagogicalCalculationMode[] = [
  "NONE",
  "SIMPLE_AVERAGE",
  "WEIGHTED_AVERAGE",
  "SUM",
  "MANUAL",
];

function getCalculationModeLabel(mode: PedagogicalCalculationMode) {
  switch (mode) {
    case "NONE":
      return "Aucun";
    case "SIMPLE_AVERAGE":
      return "Moyenne simple";
    case "SUM":
      return "Somme";
    case "MANUAL":
      return "Manuel";
    default:
      return "Moyenne ponderee";
  }
}

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

  return "La structure pedagogique n'a pas pu etre enregistree.";
}

function getDefaultFormState(
  niveauId = "",
  overrides: Partial<FormState> = {},
): FormState {
  return {
    niveau_scolaire_id: niveauId,
    parent_id: "",
    matiere_id: "",
    item_type: "SUBJECT",
    code: "",
    nom: "",
    description: "",
    display_order: "0",
    coefficient: "",
    weight: "",
    is_evaluable: false,
    is_visible_on_report: true,
    is_required: false,
    calculation_mode: "WEIGHTED_AVERAGE",
    is_active: true,
    ...overrides,
  };
}

function flattenTree(
  nodes: PedagogicalTreeNode[],
  depth = 0,
): Array<{ node: PedagogicalTreeNode; depth: number }> {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenTree(node.enfants ?? [], depth + 1),
  ]);
}

function collectDescendantIds(node?: PedagogicalTreeNode | null): Set<string> {
  const ids = new Set<string>();
  if (!node) return ids;

  const visit = (current: PedagogicalTreeNode) => {
    ids.add(current.id);
    (current.enfants ?? []).forEach(visit);
  };

  visit(node);
  return ids;
}

function PedagogicalStructureIndex() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [niveaux, setNiveaux] = useState<NiveauScolaire[]>([]);
  const [matieres, setMatieres] = useState<MatiereWithRelations[]>([]);
  const [selectedNiveauId, setSelectedNiveauId] = useState("");
  const [tree, setTree] = useState<PedagogicalTreeNode[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [formState, setFormState] = useState<FormState>(getDefaultFormState());
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const service = useMemo(() => new PedagogicalItemService(), []);

  const flatItems = useMemo(() => flattenTree(tree), [tree]);
  const selectedItem = useMemo(
    () => flatItems.find((item) => item.node.id === selectedItemId)?.node ?? null,
    [flatItems, selectedItemId],
  );
  const descendantIds = useMemo(
    () => collectDescendantIds(selectedItem),
    [selectedItem],
  );

  const parentOptions = useMemo(
    () =>
      flatItems.filter(
        ({ node }) =>
          node.niveau_scolaire_id === (formState.niveau_scolaire_id || selectedNiveauId) &&
          !descendantIds.has(node.id),
      ),
    [descendantIds, flatItems, formState.niveau_scolaire_id, selectedNiveauId],
  );

  const loadTree = async (niveauId: string) => {
    if (!etablissement_id) return;

    setTreeLoading(true);
    try {
      const response = await service.getTree({
        niveau_scolaire_id: niveauId || undefined,
      });
      const items =
        response?.status?.success
          ? (((response.data as { data?: unknown })?.data ??
              response.data) as PedagogicalTreeNode[])
          : [];
      setTree(items ?? []);
    } catch {
      setTree([]);
      info("Impossible de charger la structure pedagogique.", "error");
    } finally {
      setTreeLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!etablissement_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const niveauService = new NiveauScolaireService();
        const matiereService = new MatiereService();
        const year = await anneeScolaireService.getCurrent(etablissement_id);
        const currentYearValue = (year as AnneeScolaire | null) ?? null;
        const [niveauxResponse, matieresResponse] = await Promise.all([
          niveauService.getAll({
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
          }),
          matiereService.getForEtablissement(etablissement_id, {
            includeSpec: JSON.stringify({ departement: true }),
            orderBy: JSON.stringify([{ nom: "asc" }]),
          }),
        ]);

        if (!active) return;

        const loadedNiveaux =
          niveauxResponse?.status?.success
            ? ((niveauxResponse.data.data as NiveauScolaire[]) ?? [])
            : [];
        const loadedMatieres =
          matieresResponse?.status?.success
            ? ((matieresResponse.data.data as MatiereWithRelations[]) ?? [])
            : [];

        setCurrentYear(currentYearValue);
        setNiveaux(loadedNiveaux);
        setMatieres(loadedMatieres);

        const initialNiveauId = loadedNiveaux[0]?.id ?? "";
        setSelectedNiveauId(initialNiveauId);
        setFormState(getDefaultFormState(initialNiveauId));

        if (initialNiveauId) {
          await loadTree(initialNiveauId);
        }
      } catch {
        if (!active) return;
        info("Impossible d'initialiser l'ecran de structure pedagogique.", "error");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const handleSelectNiveau = async (niveauId: string) => {
    setSelectedNiveauId(niveauId);
    setSelectedItemId("");
    setFormState(getDefaultFormState(niveauId));
    await loadTree(niveauId);
  };

  const handleSelectItem = (item: PedagogicalTreeNode) => {
    setSelectedItemId(item.id);
    setFormState({
      id: item.id,
      niveau_scolaire_id: item.niveau_scolaire_id,
      parent_id: item.parent_id ?? "",
      matiere_id: item.matiere_id ?? "",
      item_type: item.item_type,
      code: item.code ?? "",
      nom: item.nom,
      description: item.description ?? "",
      display_order: `${item.display_order ?? 0}`,
      coefficient: item.coefficient !== null ? `${item.coefficient}` : "",
      weight: item.weight !== null ? `${item.weight}` : "",
      is_evaluable: item.is_evaluable,
      is_visible_on_report: item.is_visible_on_report,
      is_required: item.is_required,
      calculation_mode: item.calculation_mode,
      is_active: item.is_active,
    });
  };

  const handleNewRoot = () => {
    setSelectedItemId("");
    setFormState(getDefaultFormState(selectedNiveauId));
  };

  const handleNewChild = () => {
    if (!selectedItem) {
      info("Selectionne d'abord un element parent.", "warning");
      return;
    }

    setFormState(
      getDefaultFormState(selectedItem.niveau_scolaire_id, {
        parent_id: selectedItem.id,
        matiere_id: selectedItem.matiere_id ?? "",
        item_type: "DOMAIN",
        display_order: `${(selectedItem.enfants ?? []).length}`,
      }),
    );
  };

  const refreshCurrentTree = async () => {
    await loadTree(selectedNiveauId);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!etablissement_id) {
      info("Aucun etablissement actif n'est defini.", "error");
      return;
    }

    if (!currentYear?.id) {
      info("Aucune année scolaire courante n’est définie.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        etablissement_id,
        annee_scolaire_id: currentYear.id,
        niveau_scolaire_id: formState.niveau_scolaire_id,
        parent_id: formState.parent_id || null,
        matiere_id: formState.matiere_id || null,
        item_type: formState.item_type,
        code: formState.code.trim() || null,
        nom: formState.nom.trim(),
        description: formState.description.trim() || null,
        display_order: Number(formState.display_order || 0),
        coefficient: formState.coefficient.trim() ? Number(formState.coefficient) : null,
        weight: formState.weight.trim() ? Number(formState.weight) : null,
        is_evaluable: formState.is_evaluable,
        is_visible_on_report: formState.is_visible_on_report,
        is_required: formState.is_required,
        calculation_mode: formState.calculation_mode,
        is_active: formState.is_active,
      };

      if (formState.id) {
        await service.update(formState.id, payload);
        info("Element pedagogique mis a jour avec succes.", "success");
      } else {
        await service.create(payload);
        info("Element pedagogique cree avec succes.", "success");
      }

      await loadTree(formState.niveau_scolaire_id || selectedNiveauId);
      setFormState(getDefaultFormState(formState.niveau_scolaire_id || selectedNiveauId));
      setSelectedItemId("");
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItemId) {
      info("Selectionne un element a supprimer.", "warning");
      return;
    }

    if (!window.confirm("Supprimer cet element pedagogique ?")) {
      return;
    }

    try {
      await service.delete(selectedItemId);
      info("Element pedagogique supprime avec succes.", "success");
      setSelectedItemId("");
      setFormState(getDefaultFormState(selectedNiveauId));
      await loadTree(selectedNiveauId);
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  const renderTreeNode = (node: PedagogicalTreeNode, depth = 0) => {
    const isSelected = node.id === selectedItemId;

    return (
      <div key={node.id} className="space-y-3">
        <button
          type="button"
          onClick={() => handleSelectItem(node)}
          className={`flex w-full items-start justify-between rounded-[20px] border px-4 py-3 text-left transition ${
            isSelected
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
          }`}
          style={{ marginLeft: depth * 14 }}
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{node.nom}</span>
            <span
              className={`mt-1 block text-xs ${
                isSelected ? "text-slate-200" : "text-slate-500"
              }`}
            >
              {getPedagogicalItemTypeLabel(node.item_type)}
              {node.matiere ? ` • ${getMatiereDisplayLabel(node.matiere)}` : ""}
            </span>
          </span>
          <span
            className={`ml-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
              isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            #{node.display_order ?? 0}
          </span>
        </button>

        {(node.enfants ?? []).length > 0 ? (
          <div className="space-y-3">
            {node.enfants!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <ERPPage
      title="Structure pedagogique"
      description="Construire l'arbre matieres, domaines, sous-domaines, competences et objectifs utilise par les evaluations et les bulletins."
      headerActions={[
        <button
          key="refresh"
          type="button"
          onClick={() => void refreshCurrentTree()}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <FiRefreshCw className="h-4 w-4" />
          Actualiser
        </button>,
      ]}
    >
      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center">
          <Spin />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Niveau scolaire
                </label>
                <select
                  value={selectedNiveauId}
                  onChange={(event) => void handleSelectNiveau(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  {niveaux.map((niveau) => (
                    <option key={niveau.id} value={niveau.id}>
                      {niveau.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={handleNewRoot}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FiPlus className="h-4 w-4" />
                  Nouvel element racine
                </button>
                <button
                  type="button"
                  onClick={handleNewChild}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FiGitBranch className="h-4 w-4" />
                  Ajouter un enfant
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!selectedItemId}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiTrash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Arbre pedagogique
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Selectionne un element pour l'editer ou cree un nouveau noeud.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {flatItems.length} element(s)
                </div>
              </div>

              {treeLoading ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <Spin />
                </div>
              ) : tree.length > 0 ? (
                <div className="space-y-3">{tree.map((node) => renderTreeNode(node))}</div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                  Aucun element pedagogique n'est encore defini pour ce niveau.
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiEdit2 />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {formState.id ? "Modifier un element" : "Nouvel element"}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Configure le type, le rattachement et les regles d'affichage.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Niveau
                    </label>
                    <select
                      value={formState.niveau_scolaire_id}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          niveau_scolaire_id: event.target.value,
                          parent_id: "",
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    >
                      <option value="">Selectionner un niveau</option>
                      {niveaux.map((niveau) => (
                        <option key={niveau.id} value={niveau.id}>
                          {niveau.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Type
                    </label>
                    <select
                      value={formState.item_type}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          item_type: event.target.value as PedagogicalItemType,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    >
                      {ITEM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {getPedagogicalItemTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Parent
                    </label>
                    <select
                      value={formState.parent_id}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          parent_id: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    >
                      <option value="">Aucun parent</option>
                      {parentOptions.map(({ node, depth }) => (
                        <option key={node.id} value={node.id}>
                          {`${"  ".repeat(depth)}${node.nom} (${getPedagogicalItemTypeLabel(node.item_type)})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Matiere liee
                    </label>
                    <select
                      value={formState.matiere_id}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          matiere_id: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    >
                      <option value="">Aucune matiere</option>
                      {matieres.map((matiere) => (
                        <option key={matiere.id} value={matiere.id}>
                          {getMatiereDisplayLabel(matiere)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Code
                    </label>
                    <input
                      type="text"
                      value={formState.code}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Ordre d'affichage
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formState.display_order}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          display_order: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={formState.nom}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        nom: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Description
                  </label>
                  <textarea
                    value={formState.description}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={4}
                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Coefficient
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={formState.coefficient}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          coefficient: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Poids
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={formState.weight}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          weight: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Mode de calcul
                    </label>
                    <select
                      value={formState.calculation_mode}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          calculation_mode:
                            event.target.value as PedagogicalCalculationMode,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                    >
                      {CALCULATION_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {getCalculationModeLabel(mode)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {(
                    [
                      ["is_evaluable", "Element evaluable"],
                      ["is_visible_on_report", "Visible dans le bulletin"],
                      ["is_required", "Element requis"],
                      ["is_active", "Element actif"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={formState[key]}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleNewRoot}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Reinitialiser
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? <Spin inline /> : null}
                    {formState.id ? "Mettre a jour" : "Enregistrer"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      )}
    </ERPPage>
  );
}

export default PedagogicalStructureIndex;
