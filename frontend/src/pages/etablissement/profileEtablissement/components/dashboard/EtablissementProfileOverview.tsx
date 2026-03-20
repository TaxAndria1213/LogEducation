import { useEffect, useMemo, useState } from "react";
import {
  FiClock,
  FiCode,
  FiSettings,
  FiSliders,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import EtablissementService from "../../../../../services/etablissement.service";
import type { Etablissement } from "../../../../../types/models";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuilding } from "@fortawesome/free-solid-svg-icons";

type Props = {
  mode?: "overview" | "settings";
};

function formatDate(value?: Date | string | null) {
  if (!value) return "Non renseigne";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseigne";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatParamValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value == null) {
    return "Non defini";
  }

  return JSON.stringify(value, null, 2);
}

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

  return "Impossible de charger le profil de l'etablissement.";
}

function EtablissementProfileOverview({ mode = "overview" }: Props) {
  const { user, etablissement_id } = useAuth();
  const service = useMemo(() => new EtablissementService(), []);

  const [etablissement, setEtablissement] = useState<Etablissement | null>(
    user?.etablissement ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadEtablissement = async () => {
      if (!etablissement_id) return;

      setLoading(true);
      setErrorMessage("");

      try {
        const response = await service.get(etablissement_id);
        if (!active) return;
        setEtablissement(response.data as Etablissement);
      } catch (error: unknown) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadEtablissement();

    return () => {
      active = false;
    };
  }, [etablissement_id, service]);

  const settingsEntries = useMemo(() => {
    if (!etablissement?.parametres_json || typeof etablissement.parametres_json !== "object") {
      return [];
    }

    return Object.entries(etablissement.parametres_json as Record<string, unknown>);
  }, [etablissement?.parametres_json]);

  if (!etablissement_id && !user?.etablissement) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900">
        Aucun etablissement n'est associe a cet utilisateur.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FontAwesomeIcon icon={faBuilding} />
              Profil de l'etablissement
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {etablissement?.nom ?? user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les parametres generaux et les informations techniques de l'etablissement connecte."
                  : "Cette page par defaut presente l'etablissement rattache a l'utilisateur connecte."}
              </p>
            </div>
          </div>
          {loading ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Chargement...
            </span>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCode />
            <span className="text-sm font-medium">Code</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {etablissement?.code ?? "Non renseigne"}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiClock />
            <span className="text-sm font-medium">Fuseau horaire</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {etablissement?.fuseau_horaire ?? "Non renseigne"}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FontAwesomeIcon icon={faBuilding} />
            <span className="text-sm font-medium">Cree le</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {formatDate(etablissement?.created_at)}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiSettings />
            <span className="text-sm font-medium">Mis a jour le</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {formatDate(etablissement?.updated_at)}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <FiSliders />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {mode === "settings" ? "Parametres de l'etablissement" : "Resume technique"}
            </h3>
            <p className="text-sm text-slate-500">
              {mode === "settings"
                ? "Les parametres enregistres pour cet etablissement sont resumes ci-dessous."
                : "Informations techniques utiles pour verifier la configuration actuelle."}
            </p>
          </div>
        </div>

        {settingsEntries.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {settingsEntries.map(([key, value]) => (
              <div
                key={key}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {key}
                </p>
                <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-800">
                  {formatParamValue(value)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Aucun parametre specifique n'est enregistre pour cet etablissement.
          </div>
        )}
      </section>
    </div>
  );
}

export default EtablissementProfileOverview;
