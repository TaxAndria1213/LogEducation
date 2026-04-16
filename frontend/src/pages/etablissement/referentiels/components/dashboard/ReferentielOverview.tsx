import { useMemo } from "react";
import Spin from "../../../../../components/anim/Spin";
import { useReferentialCatalog } from "../../hooks/useReferentialCatalog";

type Props = {
  mode?: "overview" | "settings";
};

export default function ReferentielOverview({ mode = "overview" }: Props) {
  const { rows, loading, errorMessage } = useReferentialCatalog();

  const customValuesCount = useMemo(
    () => rows.reduce((sum, item) => sum + item.values.length, 0),
    [rows],
  );

  const configuredCount = useMemo(
    () => rows.filter((item) => item.values.length > 0).length,
    [rows],
  );

  const uncovered = useMemo(
    () => rows.filter((item) => item.values.length === 0),
    [rows],
  );

  if (loading) {
    return <Spin label="Chargement des referentiels..." showLabel />;
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Categories</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {rows.length}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Categories configurees</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {configuredCount}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Valeurs personnalisees</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {customValuesCount}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Champs couverts</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {rows.reduce((sum, item) => sum + item.fieldTargets.length, 0)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Categories suivies
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Chaque categorie alimente un ou plusieurs champs metier.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {rows.map((item) => (
              <div
                key={item.code}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.titre}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.description}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {item.values.length > 0
                      ? `${item.values.length} valeur(s)`
                      : `${item.defaultValues.length} valeur(s) par defaut`}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(item.values.length > 0
                    ? item.values.map((value) => value.valeur)
                    : item.defaultValues
                  )
                    .slice(0, 6)
                    .map((value) => (
                      <span
                        key={`${item.code}-${value}`}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {value}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            Points d'attention
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Categories encore sur les valeurs par defaut.
          </p>

          <div className="mt-5 space-y-3">
            {uncovered.length > 0 ? (
              uncovered.map((item) => (
                <div
                  key={item.code}
                  className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4"
                >
                  <p className="text-sm font-semibold text-amber-900">
                    {item.titre}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    {item.fieldTargets.join(" | ")}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                Toutes les categories suivies ont deja au moins une valeur
                personnalisee.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

