import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiChevronUp, FiSearch } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import {
  SelectionWorkspaceHeaderCard,
  SelectionWorkspacePanel,
} from "../../../../../components/page/SelectionWorkspace";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import RoleService from "../../../../../services/role.service";
import {
  mergeScopePermissions,
  normalizePermissionCodes,
  permissionMatches,
} from "../../../../../utils/permissionScope";
import { useRoleCreateStore } from "../../store/RoleCreateStore";
import { FEATURE_GROUPS, ROLE_TEMPLATES } from "../../roleTemplates";

function togglePermission(current: string[], code: string) {
  return current.includes(code)
    ? current.filter((item) => item !== code)
    : [...current, code];
}

function isFeatureSelected(current: string[], code: string) {
  return current.some((item) => permissionMatches(item, code));
}

function expandTemplatePermissions(permissions: string[]) {
  const allItems = FEATURE_GROUPS.flatMap((group) => group.items);
  const expanded = permissions.flatMap((permissionCode) => {
    const matches = allItems
      .filter((item) => permissionMatches(permissionCode, item.code))
      .map((item) => item.code);
    return matches.length > 0 ? matches : [permissionCode];
  });

  return normalizePermissionCodes(expanded);
}

function getExpandedGroupsForPermissions(selectedPermissions: string[]) {
  return FEATURE_GROUPS.filter((group) =>
    group.items.some((item) => isFeatureSelected(selectedPermissions, item.code)),
  ).map((group) => group.key);
}

function normalizeRoleGuardToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, " ");
}

function isForbiddenAdminRoleName(value: string) {
  return ["ADMIN", "ADMINISTRATEUR", "ADMINISTRATOR", "SUPER ADMIN", "SUPERADMIN"].includes(
    normalizeRoleGuardToken(value),
  );
}

function RoleForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new RoleService(), []);
  const loading = useRoleCreateStore((state) => state.loading);
  const templateInitialData = useRoleCreateStore((state) => state.initialData);
  const setInitialData = useRoleCreateStore((state) => state.setInitialData);

  const [roleName, setRoleName] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [permissionQuery, setPermissionQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (etablissement_id) {
      setInitialData({ etablissement_id });
    }
  }, [etablissement_id, setInitialData]);

  const activeTemplate = useMemo(
    () => ROLE_TEMPLATES.find((template) => template.key === templateKey) ?? null,
    [templateKey],
  );

  const selectedCount = selectedPermissions.length;
  const normalizedPermissionQuery = permissionQuery.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    return FEATURE_GROUPS.map((group) => {
      const groupMatches =
        group.title.toLowerCase().includes(normalizedPermissionQuery) ||
        group.description.toLowerCase().includes(normalizedPermissionQuery);

      if (!normalizedPermissionQuery) {
        return group;
      }

      const filteredItems = groupMatches
        ? group.items
        : group.items.filter((item) => {
            const haystack = [item.label, item.description, item.code]
              .join(" ")
              .toLowerCase();
            return haystack.includes(normalizedPermissionQuery);
          });

      return {
        ...group,
        items: filteredItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [normalizedPermissionQuery]);

  const onTemplateChange = (nextTemplateKey: string) => {
    const nextTemplate =
      ROLE_TEMPLATES.find((template) => template.key === nextTemplateKey) ?? null;
    const previousSuggestedName = activeTemplate?.suggestedName ?? "";
    const nextPermissions = expandTemplatePermissions(nextTemplate?.permissions ?? []);

    setTemplateKey(nextTemplateKey);
    setSelectedPermissions(nextPermissions);
    setExpandedGroups(getExpandedGroupsForPermissions(nextPermissions));

    if (!roleName.trim() || roleName.trim() === previousSuggestedName) {
      setRoleName(nextTemplate?.suggestedName ?? "");
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = roleName.trim();
    const etablissementId = etablissement_id ?? templateInitialData?.etablissement_id ?? null;

    if (!etablissementId) {
      info("Aucun etablissement actif n'est disponible pour creer le role.", "error");
      return;
    }

    if (!normalizedName) {
      info("Le nom du role est obligatoire.", "error");
      return;
    }

    if (isForbiddenAdminRoleName(normalizedName)) {
      info(
        "Le role administrateur est reserve a la plateforme et ne peut pas etre cree dans un etablissement.",
        "error",
      );
      return;
    }

    setSubmitting(true);
    try {
      const scope = {
        role_template: templateKey || null,
        role_template_label: activeTemplate?.label ?? null,
        ...mergeScopePermissions(null, selectedPermissions),
      };

      await service.create({
        nom: normalizedName,
        etablissement_id: etablissementId,
        scope_json: scope,
      });

      info("Role cree avec succes !", "success");
      setRoleName("");
      setTemplateKey("");
      setSelectedPermissions([]);
      setExpandedGroups([]);
      setPermissionQuery("");
    } catch (error) {
      console.error("Erreur creation role", error);
      info("Le role n'a pas pu etre cree.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <SelectionWorkspaceHeaderCard
            title="Creation d'un role"
            description={
              <>
                Donne un nom libre au role, choisis si besoin un modele predefini,
                puis ajuste les fonctionnalites a activer. Le role restera
                personnalise meme s&apos;il part d&apos;une base standard.
              </>
            }
            className="rounded-3xl p-6"
            headerClassName="block"
          >
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Nom du role</span>
                <input
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="Ex: Responsable pedagogique"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Modele de fonctionnalites</span>
                <select
                  value={templateKey}
                  onChange={(event) => onTemplateChange(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="">Aucun modele predefini</option>
                  {ROLE_TEMPLATES.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  {selectedCount} fonctionnalite{selectedCount > 1 ? "s" : ""}
                </span>
                <span className="text-sm text-slate-600">
                  {activeTemplate
                    ? activeTemplate.description
                    : "Tu peux partir de zero et composer ton role sur mesure."}
                </span>
              </div>
            </div>
          </SelectionWorkspaceHeaderCard>

          <SelectionWorkspacePanel
            title="Modules et autorisations"
            description={
              <>
                Ouvre seulement les groupes utiles, recherche une fonctionnalite,
                puis enregistre sans devoir descendre jusqu&apos;au bas de la page.
              </>
            }
            toolbar={
              <div className="flex flex-col gap-3 lg:items-end">
                <label className="relative block w-full lg:w-[22rem]">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={permissionQuery}
                    onChange={(event) => setPermissionQuery(event.target.value)}
                    placeholder="Rechercher un module, un code ou une action"
                    className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedGroups(filteredGroups.map((group) => group.key))}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Tout deplier
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedGroups([])}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Tout reduire
                  </button>
                </div>
              </div>
            }
            footerTitle={
              <>
                {selectedCount} fonctionnalite{selectedCount > 1 ? "s" : ""} selectionnee{selectedCount > 1 ? "s" : ""}
              </>
            }
            footerDescription="Le bouton reste accessible pendant que tu parcours les modules."
            footerAction={
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span>Enregistrer le role</span>
                {submitting ? <Spin inline /> : null}
              </button>
            }
          >
              <div className="space-y-4">
                {filteredGroups.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                    Aucune fonctionnalite ne correspond a la recherche.
                  </div>
                ) : (
                  filteredGroups.map((group) => {
                    const groupSelectedCount = group.items.filter((item) =>
                      isFeatureSelected(selectedPermissions, item.code),
                    ).length;
                    const isExpanded =
                      normalizedPermissionQuery.length > 0 ||
                      expandedGroups.includes(group.key);

                    return (
                      <section
                        key={group.key}
                        className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGroups((current) =>
                              current.includes(group.key)
                                ? current.filter((key) => key !== group.key)
                                : [...current, group.key],
                            )
                          }
                          className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-slate-900">
                                {group.title}
                              </h3>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                {groupSelectedCount}/{group.items.length} active
                              </span>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {group.description}
                            </p>
                          </div>
                          <span className="mt-1 shrink-0 rounded-full bg-slate-100 p-2 text-slate-500">
                            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                          </span>
                        </button>

                        {isExpanded ? (
                          <div className="border-t border-slate-200 px-5 py-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              {group.items.map((item) => {
                                const checked = selectedPermissions.includes(item.code);
                                return (
                                  <label
                                    key={item.code}
                                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                                      checked
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        setSelectedPermissions((current) =>
                                          togglePermission(current, item.code),
                                        )
                                      }
                                      className="mt-1 h-4 w-4 accent-slate-900"
                                    />
                                    <span className="space-y-1">
                                      <span className="block text-sm font-semibold">
                                        {item.label}
                                      </span>
                                      <span
                                        className={`block text-xs ${
                                          checked ? "text-slate-200" : "text-slate-600"
                                        }`}
                                      >
                                        {item.description}
                                      </span>
                                      <span
                                        className={`block text-[11px] uppercase tracking-wide ${
                                          checked ? "text-slate-300" : "text-slate-500"
                                        }`}
                                      >
                                        {item.code}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </section>
                    );
                  })
                )}
              </div>
          </SelectionWorkspacePanel>
        </form>
      )}
    </div>
  );
}

export default RoleForm;
