import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiKey, FiLink, FiShield } from "react-icons/fi";
import { useAuth } from "../../../../../auth/AuthContext";
import Spin from "../../../../../components/anim/Spin";
import { componentPermissionCatalog } from "../../../../../components/components.build";
import PermissionService from "../../../../../services/permission.service";
import RoleService from "../../../../../services/role.service";
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

export default function PermissionDashboard() {
  const { etablissement_id } = useAuth();
  const permissionService = useMemo(() => new PermissionService(), []);
  const roleService = useMemo(() => new RoleService(), []);
  const [loading, setLoading] = useState(true);
  const [assignedCount, setAssignedCount] = useState(0);
  const [customCount, setCustomCount] = useState(0);

  useEffect(() => {
    const run = async () => {
      if (!etablissement_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [roleResult, customPermissionResult] = await Promise.all([
          roleService.getAll({
            take: 1000,
            where: JSON.stringify({ etablissement_id }),
          }),
          permissionService.getAll({
            take: 1000,
            where: JSON.stringify({ etablissement_id }),
          }),
        ]);

        const roles = roleResult?.status.success ? (roleResult.data.data as Role[]) : [];
        const customPermissions = customPermissionResult?.status.success
          ? (customPermissionResult.data.data as Permission[])
          : [];
        const count = roles.reduce(
          (total, role) => total + getRoleScopePermissions(role).length,
          0,
        );
        setAssignedCount(count);
        setCustomCount(customPermissions.length);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [etablissement_id, permissionService, roleService]);

  const describedCount = componentPermissionCatalog.filter(
    (item) => item.description,
  ).length;
  const groupedPrefixes = new Set(
    componentPermissionCatalog.map((item) => item.code.split(".")[0] || item.code),
  ).size;

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <Spin label="Chargement des permissions..." showLabel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_48%,_#ecfccb_100%)] px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Tableau de bord des permissions
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Structure les capacites techniques de l'application avant leur
          rattachement aux roles pour garder une securite lisible et evolutive.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Permissions"
          value={componentPermissionCatalog.length}
          icon={<FiKey />}
          description="Nombre total de permissions systeme definies dans le code."
        />
        <StatCard
          title="Codes documentes"
          value={describedCount}
          icon={<FiShield />}
          description="Permissions dont la description est deja renseignee."
        />
        <StatCard
          title="Permissions custom"
          value={customCount}
          icon={<FiLink />}
          description="Permissions supplementaires ajoutees en base par l'utilisateur."
        />
        <StatCard
          title="Permissions affectees"
          value={assignedCount}
          icon={<FiShield />}
          description="Permissions actuellement choisies dans les roles."
        />
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Catalogue systeme
        </h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {componentPermissionCatalog.slice(0, 18).map((permission) => (
            <span
              key={permission.code}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              {permission.code}
            </span>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          {groupedPrefixes} familles detectees a partir des prefixes de code.
        </p>
      </section>
    </div>
  );
}
