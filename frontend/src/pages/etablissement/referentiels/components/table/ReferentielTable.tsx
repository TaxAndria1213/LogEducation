import { useMemo, useState } from "react";
import { FiEdit2, FiPlus, FiRefreshCcw, FiTrash2 } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { useInfo } from "../../../../../hooks/useInfo";
import { useReferentialCatalog } from "../../hooks/useReferentialCatalog";

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

  return "L'action sur le referentiel n'a pas pu aboutir.";
}

export default function ReferentielTable() {
  const { rows, loading, errorMessage, reload, service } = useReferentialCatalog();
  const { info } = useInfo();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const totalCustomValues = useMemo(
    () => rows.reduce((sum, item) => sum + item.values.length, 0),
    [rows],
  );

  const handleAdd = async (code: string) => {
    const value = drafts[code]?.trim();
    if (!value) return;

    setBusyKey(code);
    try {
      await service.createValue(code, value);
      setDrafts((current) => ({ ...current, [code]: "" }));
      info("Valeur ajoutee au referentiel.", "success");
      await reload();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleEdit = async (id: string, currentValue: string) => {
    const nextValue = window.prompt(
      "Modifier la valeur du referentiel",
      currentValue,
    );

    if (nextValue == null || nextValue.trim() === currentValue) return;

    setBusyKey(id);
    try {
      await service.updateValue(id, nextValue);
      info("Valeur de referentiel mise a jour.", "success");
      await reload();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Supprimer cette valeur de referentiel pour l'etablissement ?",
    );
    if (!confirmed) return;

    setBusyKey(id);
    try {
      await service.deleteValue(id);
      info("Valeur de referentiel supprimee.", "success");
      await reload();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return <Spin label="Chargement des referentiels..." showLabel />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {rows.length} categories
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {totalCustomValues} valeurs personnalisees
          </span>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          <FiRefreshCcw />
          Actualiser
        </button>
      </div>
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4">
        {rows.map((item) => (
          <section
            key={item.code}
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {item.titre}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {item.description}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {item.fieldTargets.join(" â€¢ ")}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {item.code}
              </span>
            </div>

            <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Valeurs personnalisees
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.values.length > 0 ? (
                  item.values.map((value) => (
                    <div
                      key={value.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <span>{value.valeur}</span>
                      <button
                        type="button"
                        onClick={() => void handleEdit(value.id, value.valeur)}
                        disabled={busyKey === value.id}
                        className="text-slate-400 transition hover:text-slate-700 disabled:opacity-50"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(value.id)}
                        disabled={busyKey === value.id}
                        className="text-rose-400 transition hover:text-rose-700 disabled:opacity-50"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Aucune valeur personnalisee pour le moment.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Suggestions par defaut
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.defaultValues.map((value) => (
                  <span
                    key={`${item.code}-${value}`}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <input
                value={drafts[item.code] ?? ""}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [item.code]: event.target.value,
                  }))
                }
                placeholder={`Ajouter une valeur pour ${item.titre.toLowerCase()}`}
                className="h-12 flex-1 rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-slate-400"
              />
              <button
                type="button"
                onClick={() => void handleAdd(item.code)}
                disabled={busyKey === item.code}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <FiPlus />
                Ajouter
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

