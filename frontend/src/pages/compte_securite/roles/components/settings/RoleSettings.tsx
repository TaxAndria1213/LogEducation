import { FiCopy, FiLink, FiUsers } from "react-icons/fi";
import type { ReactNode } from "react";

function TipCard({
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

export default function RoleSettings() {
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_52%,_#f0fdf4_100%)] px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Parametres des roles
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Bonnes pratiques pour garder des roles propres et des liens de creation fiables.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <TipCard
          title="Nommage des roles"
          description="Utilise des noms stables comme DIRECTION, ENSEIGNANT ou SECRETARIAT pour que les automatismes de creation sachent s'il faut generer un personnel ou un enseignant."
          icon={<FiUsers />}
        />
        <TipCard
          title="Lien copie"
          description="Le lien copie depuis la liste des roles transporte maintenant le role cible et l'etablissement. Il peut donc creer le bon compte a partir d'un simple partage."
          icon={<FiCopy />}
        />
        <TipCard
          title="Creation specialisee"
          description="Pour le role ENSEIGNANT, la creation depuis le lien peut maintenant aller jusqu'au profil enseignant apres la creation du personnel."
          icon={<FiLink />}
        />
      </div>
    </div>
  );
}
