import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiCopy, FiShield, FiTag } from "react-icons/fi";
import { useAuth } from "../../../../../auth/AuthContext";
import Spin from "../../../../../components/anim/Spin";
import RoleService from "../../../../../services/role.service";
import type { Role } from "../../../../../types/models";

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

export default function RoleDashboard() {
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new RoleService(), []);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!etablissement_id) {
        setRoles([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await service.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id }),
        orderBy: JSON.stringify([{ nom: "asc" }]),
      });

      setRoles(result?.status.success ? result.data.data : []);
      setLoading(false);
    };

    void run();
  }, [etablissement_id, service]);

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <Spin label="Chargement des roles..." showLabel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_48%,_#eff6ff_100%)] px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Tableau de bord des roles
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Pilote les roles de l'etablissement et les liens d'inscription associes
          pour creer directement un personnel, avec un profil enseignant en plus
          pour le role ENSEIGNANT.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Roles actifs"
          value={roles.length}
          icon={<FiTag />}
          description="Nombre total de roles disponibles dans l'etablissement."
        />
        <StatCard
          title="Lien de creation"
          value={roles.length > 0 ? "Pret" : "A configurer"}
          icon={<FiCopy />}
          description="Chaque lien embarque le contexte utile pour creer automatiquement un compte personnel rattache au bon role."
        />
        <StatCard
          title="Securite"
          value="Centralisee"
          icon={<FiShield />}
          description="Les droits restent portes par les roles et leurs affectations."
        />
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Roles disponibles</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {roles.length === 0 ? (
            <span className="text-sm text-slate-500">Aucun role disponible.</span>
          ) : (
            roles.map((role) => (
              <span
                key={role.id}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                {role.nom}
              </span>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
