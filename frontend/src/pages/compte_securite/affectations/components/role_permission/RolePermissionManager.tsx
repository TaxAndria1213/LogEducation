import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../../../auth/AuthContext";
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

  const availablePermissions = useMemo(() => {
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
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Affecter des permissions aux roles
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Tu peux cocher ici les permissions systeme issues des CI ainsi que
              les permissions personnalisees ajoutees en base pour l'etablissement.
            </p>
          </div>

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
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Code ou description"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">
            Chargement des roles et permissions...
          </p>
        ) : (
          <div className="grid gap-3">
            {filteredPermissions.map((permission) => (
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

            {filteredPermissions.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucune permission a afficher.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={saveAssignments}
            disabled={saving || !selectedRoleId}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer les permissions du role"}
          </button>
        </div>
      </section>
    </div>
  );
}
