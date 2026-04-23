import { useCallback, useEffect, useMemo, useState } from "react";
import UtilisateurService from "../../../services/utilisateur.service";
import type { Utilisateur } from "../../../types/models";
import { useInfo } from "../../../hooks/useInfo";

type PendingOwnerRequest = {
  id: string;
  email: string;
  telephone: string | null;
  etablissementNom: string;
  option: string;
};

function parsePendingOwnerRequest(row: Utilisateur): PendingOwnerRequest | null {
  const rawScope = row.scope_json;
  if (!rawScope) return null;

  const parsed =
    typeof rawScope === "string"
      ? (() => {
          try {
            return JSON.parse(rawScope) as Record<string, unknown>;
          } catch {
            return null;
          }
        })()
      : typeof rawScope === "object" && rawScope !== null
        ? (rawScope as Record<string, unknown>)
        : null;

  if (!parsed) return null;

  const option = typeof parsed.option === "string" ? parsed.option.trim() : "";
  const data =
    parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
      ? (parsed.data as Record<string, unknown>)
      : null;
  const etablissement =
    data?.etablissement &&
    typeof data.etablissement === "object" &&
    !Array.isArray(data.etablissement)
      ? (data.etablissement as Record<string, unknown>)
      : null;
  const etablissementNom =
    typeof etablissement?.nom === "string" ? etablissement.nom.trim() : "";

  if (!option.toLowerCase().includes("validation") || !etablissementNom) {
    return null;
  }

  return {
    id: row.id,
    email: typeof row.email === "string" ? row.email : "Email non renseigne",
    telephone: typeof row.telephone === "string" ? row.telephone : null,
    etablissementNom,
    option,
  };
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
    "status" in error.response.data &&
    typeof error.response.data.status === "object" &&
    error.response.data.status !== null &&
    "message" in error.response.data.status &&
    typeof error.response.data.status.message === "string"
  ) {
    return error.response.data.status.message;
  }

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

  return "Impossible de charger les demandes proprietaires.";
}

export default function PendingOwnerApprovals() {
  const { info } = useInfo();
  const service = useMemo(() => new UtilisateurService(), []);
  const [requests, setRequests] = useState<PendingOwnerRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<{
    id: string;
    action: "approve" | "reject";
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await service.getPendingOwnerRegistrations({
        page: 1,
        take: 25,
      });

      const rows = Array.isArray(response?.data)
        ? (response.data as Utilisateur[])
        : [];

      setRequests(rows.map(parsePendingOwnerRequest).filter(Boolean) as PendingOwnerRequest[]);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const approveRequest = useCallback(
    async (requestId: string) => {
      setProcessing({ id: requestId, action: "approve" });

      try {
        await service.approveOwnerRegistration(requestId);
        setRequests((current) => current.filter((item) => item.id !== requestId));
        info("Proprietaire approuve et rattache a son etablissement.", "success");
      } catch (error) {
        info(getErrorMessage(error), "error");
      } finally {
        setProcessing(null);
      }
    },
    [info, service],
  );

  const rejectRequest = useCallback(
    async (requestId: string, etablissementNom: string) => {
      const confirmed = window.confirm(
        `Rejeter definitivement la demande proprietaire pour ${etablissementNom} ?`,
      );
      if (!confirmed) return;

      setProcessing({ id: requestId, action: "reject" });

      try {
        await service.rejectOwnerRegistration(requestId);
        setRequests((current) => current.filter((item) => item.id !== requestId));
        info("Demande proprietaire rejetee avec succes.", "success");
      } catch (error) {
        info(getErrorMessage(error), "error");
      } finally {
        setProcessing(null);
      }
    },
    [info, service],
  );

  return (
    <section className="space-y-3 rounded-[20px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Demandes proprietaires
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Validation admin des nouveaux etablissements et de leur direction.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRequests()}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Chargement..." : "Rafraichir"}
        </button>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Aucune demande proprietaire en attente.
        </div>
      ) : (
        <div className="max-h-[18rem] space-y-2 overflow-y-auto pr-1">
          {requests.map((request) => (
            <article
              key={request.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {request.etablissementNom}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">{request.email}</p>
                  {request.telephone ? (
                    <p className="mt-1 text-xs text-slate-500">{request.telephone}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void rejectRequest(request.id, request.etablissementNom)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={processing?.id === request.id}
                  >
                    {processing?.id === request.id && processing.action === "reject"
                      ? "Rejet..."
                      : "Rejeter"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void approveRequest(request.id)}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={processing?.id === request.id}
                  >
                    {processing?.id === request.id && processing.action === "approve"
                      ? "Validation..."
                      : "Approuver"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
