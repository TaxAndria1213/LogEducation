import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiCheckCircle, FiClock, FiUsers } from "react-icons/fi";
import { useAuth } from "../../../../../auth/AuthContext";
import Spin from "../../../../../components/anim/Spin";
import UtilisateurService from "../../../../../services/utilisateur.service";
import type { Utilisateur } from "../../../../../types/models";

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

export default function UtilisateurDashboard() {
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new UtilisateurService(), []);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Utilisateur[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!etablissement_id) {
        setUsers([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await service.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id }),
      });

      setUsers(result?.status.success ? result.data.data : []);
      setLoading(false);
    };

    void run();
  }, [etablissement_id, service]);

  const activeUsers = users.filter((user) => user.statut === "ACTIF").length;
  const inactiveUsers = users.filter((user) => user.statut !== "ACTIF").length;

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <Spin label="Chargement des utilisateurs..." showLabel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_48%,_#eef2ff_100%)] px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Tableau de bord des utilisateurs
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Vision rapide des comptes actifs, a approuver ou a nettoyer dans l'etablissement.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total"
          value={users.length}
          icon={<FiUsers />}
          description="Tous les comptes lies a l'etablissement."
        />
        <StatCard
          title="Actifs"
          value={activeUsers}
          icon={<FiCheckCircle />}
          description="Comptes pouvant se connecter normalement."
        />
        <StatCard
          title="En attente"
          value={inactiveUsers}
          icon={<FiClock />}
          description="Comptes a approuver ou finaliser."
        />
      </section>
    </div>
  );
}
