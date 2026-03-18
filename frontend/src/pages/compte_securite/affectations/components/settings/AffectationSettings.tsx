import { FiFilter, FiLink, FiShield } from "react-icons/fi";
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

export default function AffectationSettings() {
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_52%,_#dcfce7_100%)] px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Parametres des affectations et du scope
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Les permissions definissent les capacites, les roles regroupent ces
          permissions, puis le scope ajuste la portee pour chaque utilisateur.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <SettingCard
          title="Permission = code CI"
          description="Le code technique de permission reprend directement l'identifiant de composant CI afin de garder une source unique de verite pour l'UI."
          icon={<FiLink />}
        />
        <SettingCard
          title="Role = paquet de permissions"
          description="Le role ne donne plus un acces implicite : son scope_json porte une liste de permissions systeme precise qui controle l'affichage et les actions."
          icon={<FiShield />}
        />
        <SettingCard
          title="Scope = filtre de portee"
          description="Le scope JSON de l'affectation utilisateur-role permet ensuite de limiter l'acces a certaines classes, sites ou entites, et meme d'ajouter ou retirer des permissions fines."
          icon={<FiFilter />}
        />
      </div>
    </div>
  );
}
