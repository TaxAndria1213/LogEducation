import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiCalendar, FiSmile, FiUserCheck } from "react-icons/fi";
import { useAuth } from "../../../../../auth/AuthContext";
import Spin from "../../../../../components/anim/Spin";
import ProfileService from "../../../../../services/profile.service";
import type { Profil } from "../../../../../types/models";

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

export default function ProfileDashboard() {
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new ProfileService(), []);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profil[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!etablissement_id) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await service.getAll({
        take: 1000,
        includeSpec: JSON.stringify({ utilisateur: true }),
        where: JSON.stringify({
          utilisateur: {
            is: {
              etablissement_id,
            },
          },
        }),
        orderBy: JSON.stringify([{ created_at: "desc" }]),
      });

      setProfiles(result?.status.success ? result.data.data : []);
      setLoading(false);
    };

    void run();
  }, [etablissement_id, service]);

  const withBirthday = profiles.filter((profile) => profile.date_naissance).length;
  const withGender = profiles.filter((profile) => profile.genre).length;
  const recentProfiles = profiles.slice(0, 5);

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <Spin label="Chargement des profils..." showLabel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_48%,_#fef3c7_100%)] px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Tableau de bord des profils
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Suis la qualite des fiches personnelles rattachees aux comptes de
          l'etablissement et repere rapidement les informations encore
          incompletes.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Profils"
          value={profiles.length}
          icon={<FiUserCheck />}
          description="Nombre total de profils relies a des utilisateurs."
        />
        <StatCard
          title="Naissances renseignees"
          value={withBirthday}
          icon={<FiCalendar />}
          description="Profils dont la date de naissance est deja enregistree."
        />
        <StatCard
          title="Genre renseigne"
          value={withGender}
          icon={<FiSmile />}
          description="Profils ou le genre a deja ete complete."
        />
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Profils recents</h3>
        <div className="mt-4 grid gap-3">
          {recentProfiles.length === 0 ? (
            <span className="text-sm text-slate-500">Aucun profil disponible.</span>
          ) : (
            recentProfiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {profile.prenom} {profile.nom}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile.utilisateur?.email ?? "Aucun email"}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {profile.genre ?? "Genre non renseigne"}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
