import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiChevronUp, FiSearch } from "react-icons/fi";
import { useAuth } from "../../../../../auth/AuthContext";
import {
  SelectionWorkspaceHeaderCard,
  SelectionWorkspacePanel,
} from "../../../../../components/page/SelectionWorkspace";
import PermissionService from "../../../../../services/permission.service";
import RoleService from "../../../../../services/role.service";
import type { Permission, Role } from "../../../../../types/models";
import { useInfo } from "../../../../../hooks/useInfo";
import { componentPermissionCatalog } from "../../../../../components/components.build";
import {
  getScopePermissionCodes,
  mergeScopePermissions,
  normalizePermissionCodes,
} from "../../../../../utils/permissionScope";

function getRolePermissionCodes(role: Role | undefined): string[] {
  return getScopePermissionCodes(role?.scope_json);
}

type AvailablePermission = {
  code: string;
  description: string;
  type: "system" | "system-admin" | "custom";
};

const PERMISSION_GROUP_LABELS: Record<string, string> = {
  ADM: "Administration",
  ET: "Etablissement",
  CS: "Comptes & securite",
  SC: "Scolarite",
  PE: "Personnel",
  PD: "Pedagogie",
  EDT: "Emploi du temps",
  PR: "Presences",
  DI: "Discipline",
  FIN: "Finance",
  TC: "Transport & cantine",
  BI: "Bibliotheque",
};

export default function RolePermissionManager() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();

  const permissionService = useMemo(() => new PermissionService(), []);
  const roleService = useMemo(() => new RoleService(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [customPermissions, setCustomPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<string[]>(
    [],
  );
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!etablissement_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [rolesResult, customPermissionResult] = await Promise.all([
          roleService.getAll({
            take: 1000,
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ nom: "asc" }]),
          }),
          permissionService.getAll({
            take: 1000,
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ code: "asc" }]),
          }),
        ]);

        const nextRoles = rolesResult?.status.success ? rolesResult.data.data : [];
        const nextCustomPermissions = customPermissionResult?.status.success
          ? customPermissionResult.data.data
          : [];

        setRoles(nextRoles);
        setCustomPermissions(nextCustomPermissions);
        if (!selectedRoleId && nextRoles[0]?.id) {
          setSelectedRoleId(nextRoles[0].id);
        }
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [etablissement_id, permissionService, roleService]);

  useEffect(() => {
    const currentRole = roles.find((role) => role.id === selectedRoleId);
    setSelectedPermissionCodes(getRolePermissionCodes(currentRole));
  }, [roles, selectedRoleId]);

  const availablePermissions = useMemo<AvailablePermission[]>(() => {
    const items = new Map<
      string,
      {
        code: string;
        description: string;
        type: "system" | "system-admin" | "custom";
      }
    >();

    for (const item of componentPermissionCatalog) {
      items.set(item.code, {
        code: item.code,
        description: item.description,
        type: item.adminOnly ? "system-admin" : "system",
      });
    }

    for (const item of customPermissions) {
      if (items.has(item.code)) continue;

      items.set(item.code, {
        code: item.code,
        description: item.description ?? "Permission personnalisee",
        type: "custom",
      });
    }

    return [...items.values()].sort((left, right) =>
      left.code.localeCompare(right.code),
    );
  }, [customPermissions]);

  const filteredPermissions = availablePermissions.filter((permission) => {
    const text = search.trim().toLowerCase();
    if (!text) return true;
    return (
      permission.code.toLowerCase().includes(text) ||
      (permission.description ?? "").toLowerCase().includes(text)
    );
  });

  const groupedPermissions = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        title: string;
        items: AvailablePermission[];
      }
    >();

    for (const permission of filteredPermissions) {
      const key = permission.code.split(".")[0] ?? "AUTRE";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: PERMISSION_GROUP_LABELS[key] ?? key,
          items: [],
        });
      }
      groups.get(key)?.items.push(permission);
    }

    return [...groups.values()].sort((left, right) =>
      left.title.localeCompare(right.title),
    );
  }, [filteredPermissions]);

  const selectedCount = selectedPermissionCodes.length;
  const normalizedSearch = search.trim().toLowerCase();

  const togglePermission = (permissionCode: string) => {
    setSelectedPermissionCodes((current) =>
      current.includes(permissionCode)
        ? current.filter((id) => id !== permissionCode)
        : normalizePermissionCodes([...current, permissionCode]),
    );
  };

  const saveAssignments = async () => {
    if (!selectedRoleId) {
      info("Selectionne d'abord un role.", "warning");
      return;
    }

    setSaving(true);
    try {
      const currentRole = roles.find((role) => role.id === selectedRoleId);
      await roleService.update(selectedRoleId, {
        scope_json: mergeScopePermissions(
          currentRole?.scope_json,
          selectedPermissionCodes,
        ),
      });

      info("Affectations role / permission mises a jour.", "success");
      setRoles((current) =>
        current.map((role) =>
          role.id === selectedRoleId
            ? {
                ...role,
                scope_json: mergeScopePermissions(
                  role.scope_json,
                  selectedPermissionCodes,
                ),
              }
            : role,
        ),
      );
    } catch (error) {
      console.log("RolePermissionManager save error:", error);
      info("La mise a jour des permissions du role a echoue.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <SelectionWorkspaceHeaderCard
        title="Affecter des permissions aux roles"
        description={
          <>
            Tu peux cocher ici les permissions systeme issues des CI ainsi que
            les permissions personnalisees ajoutees en base pour l&apos;etablissement.
          </>
        }
        actions={
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-600">
              <span>Role</span>
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">Selectionner un role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.nom}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm text-slate-600">
              <span>Recherche</span>
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2"
                  placeholder="Code ou description"
                />
              </div>
            </label>
          </div>
        }
        actionsClassName="w-full lg:w-auto"
      />

      <SelectionWorkspacePanel
        title="Catalogue des permissions"
        description={
          <>
            Parcours les groupes utiles, puis enregistre sans devoir redescendre en bas.
          </>
        }
        toolbar={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setExpandedGroups(groupedPermissions.map((group) => group.key))}
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
        }
        footerTitle={
          <>
            {selectedCount} permission{selectedCount > 1 ? "s" : ""} selectionnee{selectedCount > 1 ? "s" : ""}
          </>
        }
        footerDescription="Le bouton reste disponible pendant toute la revue des permissions."
        footerAction={
          <button
            type="button"
            onClick={saveAssignments}
            disabled={saving || !selectedRoleId}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer les permissions du role"}
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-500">
            Chargement des roles et permissions...
          </p>
        ) : (
          <div className="space-y-4">
            {groupedPermissions.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucune permission a afficher.
              </p>
            ) : (
              groupedPermissions.map((group) => {
                const selectedGroupCount = group.items.filter((permission) =>
                  selectedPermissionCodes.includes(permission.code),
                ).length;
                const isExpanded =
                  normalizedSearch.length > 0 || expandedGroups.includes(group.key);

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
                            {selectedGroupCount}/{group.items.length} active
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          Prefixe {group.key}
                        </p>
                      </div>
                      <span className="mt-1 shrink-0 rounded-full bg-slate-100 p-2 text-slate-500">
                        {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-slate-200 px-5 py-4">
                        <div className="grid gap-3">
                          {group.items.map((permission) => (
                            <label
                              key={permission.code}
                              className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissionCodes.includes(permission.code)}
                                onChange={() => togglePermission(permission.code)}
                                className="mt-1"
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">
                                  {permission.code}
                                </div>
                                <div className="text-xs leading-5 text-slate-500">
                                  {permission.description || "Aucune description"}
                                </div>
                                <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                                  {permission.type === "custom"
                                    ? "Permission personnalisee"
                                    : permission.type === "system-admin"
                                      ? "Permission systeme admin"
                                      : "Permission systeme"}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>
                );
              })
            )}
          </div>
        )}
      </SelectionWorkspacePanel>
    </div>
  );
}
