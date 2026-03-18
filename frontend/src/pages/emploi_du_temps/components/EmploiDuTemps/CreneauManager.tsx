import { useState } from "react";
import { FiClock, FiPlusCircle } from "react-icons/fi";
import CreneauForm from "./CreneauForm";
import CreneauList from "./CreneauList";

export default function CreneauManager() {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_52%,_#ecfeff_100%)] p-6 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white">
              <FiClock />
              Parametrage des creneaux
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
              Gere les creneaux horaires utilises par tout le module emploi du temps.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Les creneaux definissent la colonne temporelle de la grille hebdomadaire:
              ordre d'affichage, heure de debut et heure de fin. Une fois crees ici,
              ils deviennent disponibles dans le dashboard et dans les formulaires de
              planification.
            </p>
          </div>

          <div className="rounded-[24px] border border-cyan-100 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Conseil
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              Cree d'abord tous les creneaux de la journee, puis retourne sur le dashboard
              pour construire l'emploi du temps global par classe.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
              <FiPlusCircle />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Nouveau creneau
              </h3>
              <p className="text-sm text-slate-500">
                Ajoute un horaire exploitable partout dans le module.
              </p>
            </div>
          </div>

          <CreneauForm onCreated={() => setRefreshToken((value) => value + 1)} />
        </div>

        <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Creneaux existants
            </h3>
            <p className="text-sm text-slate-500">
              Controle vite l'ordre et supprime les anciens horaires si besoin.
            </p>
          </div>

          <CreneauList refreshToken={refreshToken} />
        </div>
      </section>
    </div>
  );
}
