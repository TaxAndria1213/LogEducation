import { FiBookOpen, FiLayers, FiShield } from "react-icons/fi";
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

export default function PermissionSettings() {
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Parametres des permissions
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Quelques reperes pour garder un catalogue de permissions stable et
          simple a rattacher aux roles.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <SettingCard
          title="Codes stables"
          description="Utilise des codes courts et durables comme UTILISATEUR.CREATE ou NOTE.READ pour eviter les renommages couteux."
          icon={<FiBookOpen />}
        />
        <SettingCard
          title="Groupes logiques"
          description="Regroupe les permissions par domaine fonctionnel pour rendre les roles plus lisibles et plus rapides a maintenir."
          icon={<FiLayers />}
        />
        <SettingCard
          title="Separation des responsabilites"
          description="Les permissions decrivent une capacite, les roles portent un ensemble de permissions, et les utilisateurs recoivent des roles."
          icon={<FiShield />}
        />
      </div>
    </div>
  );
}
