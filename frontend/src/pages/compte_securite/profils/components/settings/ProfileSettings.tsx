import { FiLink, FiShield, FiUser } from "react-icons/fi";
import type { ReactNode } from "react";

function SettingCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function ProfileSettings() {
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_52%,_#fef2f2_100%)] px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Parametres des profils
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Rappels utiles pour garder des profils propres, relies au bon compte et
          faciles a exploiter dans tout le systeme.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <SettingCard
          title="Un profil par utilisateur"
          description="Chaque profil est lie a un utilisateur unique. Le formulaire propose donc en priorite les comptes qui n'ont pas encore de profil."
          icon={<FiUser />}
        />
        <SettingCard
          title="Rattachement fiable"
          description="Le module profils reste separe des roles et des affectations pour garder les informations personnelles independantes des droits d'acces."
          icon={<FiLink />}
        />
        <SettingCard
          title="Qualite des donnees"
          description="Renseigner la date de naissance, le genre et l'adresse ameliore ensuite les modules personnel, enseignant, scolarite et communication."
          icon={<FiShield />}
        />
      </div>
    </div>
  );
}
