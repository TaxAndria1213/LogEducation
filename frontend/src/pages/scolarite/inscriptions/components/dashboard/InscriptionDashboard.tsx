type InscriptionDashboardProps = {
  stats?: {
    totalInscriptions: number
    nouvellesInscriptions: number
    reinscriptions: number
    transferts: number
    sorties: number
    tauxReinscription: number
  }
  onNouvelleInscription?: () => void
  onReinscription?: () => void
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string | number
  subtitle?: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h3 className="mt-2 text-3xl font-bold text-gray-900">{value}</h3>
      {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
    </div>
  )
}

function InscriptionDashboard({
  stats = {
    totalInscriptions: 1280,
    nouvellesInscriptions: 215,
    reinscriptions: 980,
    transferts: 48,
    sorties: 37,
    tauxReinscription: 76.6,
  },
  onNouvelleInscription,
  onReinscription,
}: InscriptionDashboardProps) {

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard des inscriptions</h1>
          <p className="text-sm text-gray-500">
            Vue synthétique des indicateurs clés liés aux inscriptions scolaires.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onNouvelleInscription}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Nouvelle inscription
          </button>

          <button
            onClick={onReinscription}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Réinscription
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total des inscriptions"
          value={stats.totalInscriptions}
          subtitle="Toutes inscriptions confondues"
        />

        <StatCard
          title="Nouvelles inscriptions"
          value={stats.nouvellesInscriptions}
          subtitle="Élèves nouvellement inscrits"
        />

        <StatCard
          title="Réinscriptions"
          value={stats.reinscriptions}
          subtitle="Élèves revenant pour la nouvelle année"
        />

        <StatCard
          title="Transferts"
          value={stats.transferts}
          subtitle="Élèves transférés"
        />

        <StatCard
          title="Sorties"
          value={stats.sorties}
          subtitle="Élèves sortis de l’établissement"
        />

        <StatCard
          title="Taux de réinscription"
          value={`${stats.tauxReinscription}%`}
          subtitle="Indicateur de fidélisation"
        />
      </div>
    </div>
  )
}

export default InscriptionDashboard