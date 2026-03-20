import Service from "../app/api/Service";
import type { Departement, Matiere } from "../types/models";

type QueryParams = Record<string, unknown>;

export type MatiereWithRelations = Matiere & {
  departement?: Pick<Departement, "id" | "nom"> | null;
  cours?: Array<{ id: string }>;
  lignesProgramme?: Array<{
    id: string;
    programme?: {
      id?: string;
      nom?: string | null;
    } | null;
  }>;
};

function parseObjectParam(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return typeof parsed === "object" && parsed !== null ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function getMatiereDisplayLabel(
  matiere?: Partial<MatiereWithRelations> | null,
) {
  if (!matiere) return "Matiere sans nom";

  const code = matiere.code?.trim() ?? "";
  const nom = matiere.nom?.trim() ?? "";
  const departement = matiere.departement?.nom?.trim() ?? "";
  const primaryLabel =
    [code, nom].filter(Boolean).join(" - ") ||
    nom ||
    code ||
    "Matiere sans nom";

  return departement ? `${primaryLabel} (${departement})` : primaryLabel;
}

class MatiereService extends Service {
  constructor() {
    super("matiere");
  }

  async getForEtablissement(
    etablissementId: string,
    params: QueryParams = {},
  ) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);

    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ nom: "asc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);

    if (!parsedWhere || Object.keys(parsedWhere).length === 0) {
      return { etablissement_id: etablissementId };
    }

    return {
      AND: [parsedWhere, { etablissement_id: etablissementId }],
    };
  }
}

export default MatiereService;
