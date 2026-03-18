import { EVENT_TYPE_OPTIONS } from "../../types";

function SettingCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

export default function EventSettings() {
  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_48%,_#ecfeff_100%)] px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Reglages du calendrier evenementiel
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Cette zone sert de reference fonctionnelle pour garder un calendrier
          propre, coherent et facile a exploiter par les equipes.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SettingCard
          title="Qualite des donnees"
          description="Chaque evenement devrait avoir un titre explicite, une plage horaire valide, et idealement un site pour faciliter le pilotage multi-sites."
        />
        <SettingCard
          title="Gestion des conflits"
          description="Le systeme bloque maintenant les evenements qui se chevauchent sur un meme site. Pour les activites transversales sans lieu, le site reste optionnel."
        />
        <SettingCard
          title="Cycle de vie"
          description="Utilise la liste pour modifier, dupliquer ou supprimer un evenement. Le tableau de bord sert a suivre le jour J, les evenements a venir et la charge du mois."
        />
        <SettingCard
          title="Conventions d'ecriture"
          description="Prefere des titres courts et orientes action: 'Examen blanc Terminale', 'Reunion parents', 'Sortie scientifique', afin de rester lisible dans toutes les vues."
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">
          Typologie recommandee
        </h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {EVENT_TYPE_OPTIONS.map((item) => (
            <div
              key={item.value}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
            >
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Code utilise: <span className="font-mono">{item.value}</span>
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
