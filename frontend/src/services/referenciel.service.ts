import { Http } from "../app/api/Http";
import type { EtablissementReferenciel } from "../types/models";

export type ReferentialCatalogItem = {
  id: string;
  code: string;
  titre: string;
  description: string;
  fieldTargets: string[];
  defaultValues: string[];
  values: EtablissementReferenciel[];
};

export type ReferentialOption = {
  value: string;
  label: string;
};

function dedupeValues(values: string[]) {
  const seen = new Map<string, string>();

  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized) return;

    const key = normalized.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.set(key, normalized);
    }
  });

  return Array.from(seen.values()).sort((left, right) =>
    left.localeCompare(right, "fr", { sensitivity: "base" }),
  );
}

export function buildReferentialOptions(
  catalog: ReferentialCatalogItem[],
  code: string,
  fallbackValues: string[] = [],
): ReferentialOption[] {
  const category = catalog.find((item) => item.code === code);
  const merged = dedupeValues([
    ...(category?.defaultValues ?? []),
    ...((category?.values ?? []).map((item) => item.valeur) ?? []),
    ...fallbackValues,
  ]);

  return merged.map((value) => ({
    value,
    label: value,
  }));
}

class ReferencielService {
  async getCatalog() {
    return Http.get("/api/referenciel/catalog", {});
  }

  async getValues(code: string) {
    return Http.get(`/api/referenciel/values/${encodeURIComponent(code)}`, {});
  }

  async createValue(code: string, valeur: string) {
    return Http.post(`/api/referenciel/values/${encodeURIComponent(code)}`, {
      valeur,
    });
  }

  async updateValue(id: string, valeur: string) {
    return Http.put(`/api/referenciel/values/item/${id}`, { valeur });
  }

  async deleteValue(id: string) {
    return Http.delete(`/api/referenciel/values/item/${id}`);
  }
}

export default ReferencielService;
