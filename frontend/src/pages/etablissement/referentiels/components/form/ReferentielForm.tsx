import { useMemo, useState, type FormEvent } from "react";
import { useInfo } from "../../../../../hooks/useInfo";
import ReferencielService, {
  type ReferentialCatalogItem,
} from "../../../../../services/referenciel.service";
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

  return "La valeur n'a pas pu etre ajoutee.";
}

function getDefaultCode(rows: ReferentialCatalogItem[]) {
  return rows[0]?.code ?? "";
}

export default function ReferentielForm() {
  const { rows, loading, reload } = useReferentialCatalog();
  const { info } = useInfo();
  const service = useMemo(() => new ReferencielService(), []);
  const [code, setCode] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedCode = code || getDefaultCode(rows);

  const selectedCategory = useMemo(
    () => rows.find((item) => item.code === selectedCode) ?? null,
    [rows, selectedCode],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCode || !value.trim()) return;

    setSubmitting(true);
    try {
      await service.createValue(selectedCode, value.trim());
      info("Valeur de referentiel ajoutee.", "success");
      setValue("");
      await reload();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        Chargement des referentiels...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">
          Nouvelle valeur de referentiel
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Ajoute une valeur reutilisable dans les formulaires qui en dependent.
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Categorie
            </label>
            <select
              value={selectedCode}
              onChange={(event) => setCode(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-slate-400"
            >
              {rows.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.titre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              Nouvelle valeur
            </label>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Ex: Salle multimedia"
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-slate-400"
            />
          </div>
        </div>

        {selectedCategory ? (
          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">
              {selectedCategory.titre}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {selectedCategory.description}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {selectedCategory.fieldTargets.join(" • ")}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !selectedCode || !value.trim()}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            Ajouter la valeur
          </button>
        </div>
      </form>
    </div>
  );
}
