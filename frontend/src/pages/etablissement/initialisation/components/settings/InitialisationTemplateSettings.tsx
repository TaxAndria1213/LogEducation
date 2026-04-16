import { useEffect, useState } from "react";
import InitialisationEtablissementService from "../../../../../services/initialisationEtablissement.service";
import type { InitialisationTemplates } from "../../types";

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return "Impossible de charger les modeles d'initialisation.";
}

export default function InitialisationTemplateSettings() {
  const [templates, setTemplates] = useState<InitialisationTemplates | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const response = await InitialisationEtablissementService.getTemplates();
        setTemplates((response.data ?? null) as InitialisationTemplates | null);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-600">
        Chargement des modeles...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-5 text-sm text-rose-800">
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Niveaux standards</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(templates?.niveaux_standards ?? []).map((level) => (
            <div key={level.code} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">{level.nom}</p>
              <p className="mt-1 text-sm text-slate-600">
                {level.cycle} • ordre {level.ordre}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Roles standards</h3>
          <div className="mt-4 space-y-3">
            {(templates?.roles_standards ?? []).map((role) => (
              <article key={role.nom} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{role.nom}</p>
                <p className="mt-1 text-sm text-slate-600">{role.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Permissions de base</h3>
          <div className="mt-4 space-y-3">
            {(templates?.permissions_standards ?? []).map((permission) => (
              <article key={permission.code} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{permission.code}</p>
                <p className="mt-1 text-sm text-slate-600">{permission.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
