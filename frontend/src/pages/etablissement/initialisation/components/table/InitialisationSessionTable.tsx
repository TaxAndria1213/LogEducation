import { useEffect, useState } from "react";
import { useAuth } from "../../../../../hooks/useAuth";
import InitialisationEtablissementService from "../../../../../services/initialisationEtablissement.service";
import type { InitialisationSession } from "../../types";

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

  return "Impossible de charger l'historique d'initialisation.";
}

export default function InitialisationSessionTable() {
  const { etablissement_id } = useAuth();
  const [sessions, setSessions] = useState<InitialisationSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!etablissement_id) {
        setSessions([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");
      try {
        const response = await InitialisationEtablissementService.getSessions(
          etablissement_id,
        );
        setSessions((response.data as InitialisationSession[]) ?? []);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [etablissement_id]);

  if (!etablissement_id) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 text-sm text-slate-600">
        Aucun etablissement actif n'est disponible pour afficher l'historique.
      </div>
    );
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Historique complet</h3>
          <p className="text-sm text-slate-500">
            Vue chronologique des traces d'initialisation visibles pour l'etablissement.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          Chargement...
        </div>
      ) : errorMessage ? (
        <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-[22px] border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Libelle</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Statut</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Resume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td className="px-4 py-3 text-slate-700">{session.type}</td>
                  <td className="px-4 py-3 text-slate-900">{session.label}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {session.statut}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{session.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
