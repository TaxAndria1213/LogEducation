import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type { AbonnementTransport, ArretTransport, LigneTransport } from "../types/models";

type QueryParams = Record<string, unknown>;

export type AbonnementTransportWithRelations = AbonnementTransport & {
  eleve?: {
    id: string;
    code_eleve?: string | null;
    utilisateur?: {
      profil?: {
        prenom?: string | null;
        nom?: string | null;
      } | null;
    } | null;
  } | null;
  annee?: {
    id: string;
    nom?: string | null;
  } | null;
  ligne?: LigneTransport | null;
  arret?: ArretTransport | null;
  facture?: {
    id: string;
    numero_facture?: string | null;
    statut?: string | null;
  } | null;
};

function parseObjectParam(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === "object") return value as Record<string, unknown>;
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

export function getAbonnementTransportDisplayLabel(record?: Partial<AbonnementTransportWithRelations> | null) {
  if (!record) return "Abonnement transport";
  const fullName = [record.eleve?.utilisateur?.profil?.prenom, record.eleve?.utilisateur?.profil?.nom]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || record.eleve?.code_eleve || "Abonnement transport";
}

export function getAbonnementTransportProrataLabel(record?: Partial<AbonnementTransportWithRelations> | null) {
  const ratio =
    typeof record?.prorata_ratio === "number"
      ? record.prorata_ratio
      : Number(record?.prorata_ratio ?? 0);
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) return "Plein tarif";
  return `Prorata ${(ratio * 100).toFixed(0)}%`;
}

class AbonnementTransportService extends Service {
  constructor() {
    super("abonnement-transport");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  async changeLine(
    id: string,
    payload: {
      ligne_transport_id: string;
      arret_transport_id?: string | null;
      date_effet: string | Date;
      facturer_regularisation?: boolean;
    },
  ) {
    return Http.post(["/api", this.url, id, "change-line"].join("/"), payload);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { eleve: { is: { etablissement_id: etablissementId } } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default AbonnementTransportService;
