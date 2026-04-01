import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiKey, FiLink, FiUsers } from "react-icons/fi";
import { useAuth } from "../../../../../auth/AuthContext";
import Spin from "../../../../../components/anim/Spin";
import { componentPermissionCatalog } from "../../../../../components/components.build";
import PermissionService from "../../../../../services/permission.service";
import RoleService from "../../../../../services/role.service";
import UtilisateurRoleService from "../../../../../services/utilisateur_role.service";
import { useInfo } from "../../../../../hooks/useInfo";
import type { Permission, Role } from "../../../../../types/models";
import { getScopePermissionCodes } from "../../../../../utils/permissionScope";

function getRoleScopePermissions(role: Role) {
  return getScopePermissionCodes(role.scope_json);
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AffectationDashboard() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const permissionService = useMemo(() => new PermissionService(), []);
  const roleService = useMemo(() => new RoleService(), []);
  const userRoleService = useMemo(() => new UtilisateurRoleService(), []);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    roles: 0,
    systemPermissions: 0,
    customPermissions: 0,
    rolePermissions: 0,
    userRoles: 0,
  });

  useEffect(() => {
    const run = async () => {
      if (!etablissement_id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [rolesResult, customPermissionResult, userRolesResult] =
          await Promise.all([
            roleService.getAll({
              take: 1000,
              where: JSON.stringify({ etablissement_id }),
            }),
            permissionService.getAll({
              take: 1000,
              where: JSON.stringify({ etablissement_id }),
            }),
            userRoleService.getAll({
              take: 1000,
              includeSpec: JSON.stringify({
                role: true,
                utilisateur: true,
              }),
              where: JSON.stringify({
                utilisateur: {
                  is: {
                    etablissement_id,
                  },
                },
              }),
            }),
          ]);

        const roles = rolesResult?.status.success
          ? (rolesResult.data.data as Role[])
          : [];
        const customPermissions = customPermissionResult?.status.success
          ? (customPermissionResult.data.data as Permission[])
          : [];
        const assignedPermissionCount = roles.reduce(
          (count, role) => count + getRoleScopePermissions(role).length,
          0,
        );

        setStats({
          roles: roles.length,
          systemPermissions: componentPermissionCatalog.length,
          customPermissions: customPermissions.length,
          rolePermissions: assignedPermissionCount,
          userRoles: userRolesResult?.status.success
            ? userRolesResult.data.data.length
            : 0,
        });
      } catch (error) {
        console.log("Affectation dashboard error:", error);
        info("Le chargement des affectations a echoue.", "error");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [etablissement_id, info, permissionService, roleService, userRoleService]);

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <Spin label="Chargement des affectations..." showLabel />
      </div>
    );
  }

  return (
    <div className="space-y-6">      <section className="grid gap-4 md:grid-cols-5">
        <StatCard
          title="Roles"
          value={stats.roles}
          icon={<FiUsers />}
          description="Roles disponibles pour porter des groupes de permissions."
        />
        <StatCard
          title="Permissions systeme"
          value={stats.systemPermissions}
          icon={<FiKey />}
          description="Catalogue systeme des permissions exposees par les CI."
        />
        <StatCard
          title="Permissions custom"
          value={stats.customPermissions}
          icon={<FiLink />}
          description="Permissions supplementaires en base ajoutees manuellement."
        />
        <StatCard
          title="Permissions affectees"
          value={stats.rolePermissions}
          icon={<FiLink />}
          description="Nombre total de permissions cochees dans les scopes des roles."
        />
        <StatCard
          title="Utilisateur -> role"
          value={stats.userRoles}
          icon={<FiUsers />}
          description="Affectations des roles aux utilisateurs avec scope eventuel."
        />
      </section>
    </div>
  );
}

