import { useEffect, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { useAuth } from "../../../../../auth/AuthContext";
import {
  SelectionWorkspaceHeaderCard,
  SelectionWorkspacePanel,
} from "../../../../../components/page/SelectionWorkspace";
import RoleService from "../../../../../services/role.service";
import UtilisateurRoleService from "../../../../../services/utilisateur_role.service";
import UtilisateurService from "../../../../../services/utilisateur.service";
import type { Role, Utilisateur, UtilisateurRole } from "../../../../../types/models";
import { useInfo } from "../../../../../hooks/useInfo";

function stringifyScope(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export default function UserRoleScopeManager() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();

  const utilisateurService = useMemo(() => new UtilisateurService(), []);
  const roleService = useMemo(() => new RoleService(), []);
  const userRoleService = useMemo(() => new UtilisateurRoleService(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Utilisateur[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [scopes, setScopes] = useState<Record<string, string>>({});
  const [roleSearch, setRoleSearch] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!etablissement_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [usersResult, rolesResult] = await Promise.all([
          utilisateurService.getAll({
            take: 1000,
            includeSpec: JSON.stringify({
              profil: true,
              roles: { include: { role: true } },
            }),
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ email: "asc" }]),
          }),
          roleService.getAll({
            take: 1000,
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ nom: "asc" }]),
          }),
        ]);

        const nextUsers = usersResult?.status.success ? usersResult.data.data : [];
        const nextRoles = rolesResult?.status.success ? rolesResult.data.data : [];
        setUsers(nextUsers);
        setRoles(nextRoles);

        if (!selectedUserId && nextUsers[0]?.id) {
          setSelectedUserId(nextUsers[0].id);
        }
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [etablissement_id, roleService, selectedUserId, utilisateurService]);

  useEffect(() => {
    const loadAssignments = async () => {
      if (!selectedUserId) {
        setSelectedRoleIds([]);
        setScopes({});
        return;
      }

      const result = await userRoleService.getAll({
        take: 1000,
        where: JSON.stringify({ utilisateur_id: selectedUserId }),
      });

      const assignments = result?.status.success
        ? (result.data.data as UtilisateurRole[])
        : [];

      setSelectedRoleIds(assignments.map((item) => item.role_id));
      setScopes(
        Object.fromEntries(
          assignments.map((item) => [
            item.role_id,
            stringifyScope(item.scope_json),
          ]),
        ),
      );
    };

    void loadAssignments();
  }, [selectedUserId, userRoleService]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId],
    );
  };

  const filteredRoles = useMemo(() => {
    const normalizedSearch = roleSearch.trim().toLowerCase();
    if (!normalizedSearch) return roles;
    return roles.filter((role) => role.nom.toLowerCase().includes(normalizedSearch));
  }, [roleSearch, roles]);

  const selectedCount = selectedRoleIds.length;

  const saveAssignments = async () => {
    if (!selectedUserId) {
      info("Selectionne d'abord un utilisateur.", "warning");
      return;
    }

    setSaving(true);
    try {
      const currentResult = await userRoleService.getAll({
        take: 1000,
        where: JSON.stringify({ utilisateur_id: selectedUserId }),
      });

      const currentAssignments = currentResult?.status.success
        ? (currentResult.data.data as UtilisateurRole[])
        : [];

      const currentRoleIds = currentAssignments.map((item) => item.role_id);
      const toCreate = selectedRoleIds.filter((id) => !currentRoleIds.includes(id));
      const toDelete = currentAssignments.filter(
        (item) => !selectedRoleIds.includes(item.role_id),
      );
      const toUpdate = currentAssignments.filter((item) =>
        selectedRoleIds.includes(item.role_id),
      );

      const safeScopeValue = (roleId: string) => {
        const value = scopes[roleId]?.trim();
        if (!value) return null;
        return JSON.parse(value);
      };

      await Promise.all([
        ...toCreate.map((role_id) =>
          userRoleService.createAssignment({
            utilisateur_id: selectedUserId,
            role_id,
            scope_json: safeScopeValue(role_id),
          }),
        ),
        ...toUpdate.map((item) =>
          userRoleService.updateAssignment(item.utilisateur_id, item.role_id, {
            scope_json: safeScopeValue(item.role_id),
          }),
        ),
        ...toDelete.map((item) =>
          userRoleService.deleteAssignment(item.utilisateur_id, item.role_id),
        ),
      ]);

      info("Affectations utilisateur / role / scope mises a jour.", "success");
    } catch (error) {
      console.log("UserRoleScopeManager save error:", error);
      info(
        "La mise a jour des affectations a echoue. Verifie le JSON du scope.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <SelectionWorkspaceHeaderCard
        title="Affecter des roles aux utilisateurs"
        description={
          <>
            Le scope JSON permet de limiter ou d&apos;enrichir la portee d&apos;un role
            pour un utilisateur donne.
          </>
        }
        actions={
          <label className="grid gap-1 text-sm text-slate-600">
            <span>Utilisateur</span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2"
            >
              <option value="">Selectionner un utilisateur</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {[user.profil?.prenom, user.profil?.nom]
                    .filter(Boolean)
                    .join(" ") ||
                    user.email ||
                    user.telephone ||
                    user.id}
                </option>
                ))}
              </select>
          </label>
        }
      />

      <SelectionWorkspacePanel
        title="Roles attribuables"
        description={
          <>
            Recherche un role, ouvre seulement ceux qui t&apos;interessent, puis
            enregistre sans redescendre en bas de la page.
          </>
        }
        toolbar={
          <label className="relative block w-full lg:w-[22rem]">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={roleSearch}
              onChange={(event) => setRoleSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2"
              placeholder="Rechercher un role"
            />
          </label>
        }
        footerTitle={
          <>
            {selectedCount} role{selectedCount > 1 ? "s" : ""} selectionne{selectedCount > 1 ? "s" : ""}
          </>
        }
        footerDescription="Les scopes JSON restent juste sous chaque role active."
        footerAction={
          <button
            type="button"
            onClick={saveAssignments}
            disabled={saving || !selectedUserId}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer les affectations"}
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-500">
            Chargement des utilisateurs et roles...
          </p>
        ) : (
          <div className="grid gap-3">
            {filteredRoles.map((role) => {
              const checked = selectedRoleIds.includes(role.id);
              return (
                <div
                  key={role.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(role.id)}
                    />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {role.nom}
                      </div>
                      <div className="text-xs text-slate-500">
                        Scope optionnel pour personnaliser la portee.
                      </div>
                    </div>
                  </label>

                  {checked ? (
                    <textarea
                      value={scopes[role.id] ?? ""}
                      onChange={(e) =>
                        setScopes((current) => ({
                          ...current,
                          [role.id]: e.target.value,
                        }))
                      }
                      className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                      placeholder='{"classe_ids":["..."],"site_ids":["..."],"allowed_permissions":["SC.CLASSES.MENUACTION.LIST"],"denied_permissions":["SC.CLASSES.MENUACTION.ADD"]}'
                    />
                  ) : null}
                </div>
              );
            })}

            {filteredRoles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                Aucun role ne correspond a la recherche.
              </div>
            ) : null}
          </div>
        )}
      </SelectionWorkspacePanel>
    </div>
  );
}
