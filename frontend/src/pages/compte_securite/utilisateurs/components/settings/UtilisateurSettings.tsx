import { FiKey, FiShield, FiUserPlus } from "react-icons/fi";
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

export default function UtilisateurSettings() {
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Parametres utilisateurs
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Rappels utiles pour les creations manuelles, les liens d'invitation et les affectations de comptes.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <SettingCard
          title="Creation manuelle"
          description="Le formulaire de creation utilisateur utilise maintenant la bonne route backend et renseigne directement l'etablissement actif."
          icon={<FiUserPlus />}
        />
        <SettingCard
          title="Mot de passe"
          description="Les mots de passe saisis sont envoyes a la route de creation dediee qui applique le hash cote serveur avant enregistrement."
          icon={<FiKey />}
        />
        <SettingCard
          title="Affectation des roles"
          description="Les affectations restent gerees separement afin de garder les comptes, les profils et les droits bien decouples."
          icon={<FiShield />}
        />
      </div>
    </div>
  );
}
