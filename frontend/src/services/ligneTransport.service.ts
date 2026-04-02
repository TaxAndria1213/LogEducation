import Service from "../app/api/Service";
import type { LigneTransport } from "../types/models";

type QueryParams = Record<string, unknown>;

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

export function getLigneTransportDisplayLabel(record?: Partial<LigneTransport> | null) {
  if (!record) return "Ligne non renseignee";
  return record.nom?.trim() || "Ligne non renseignee";
}

export function getLigneTransportSettings(record?: Partial<LigneTransport> | null) {
  const raw = record?.infos_vehicule_json;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      zones: [] as string[],
      zoneTarifs: {} as Record<string, number>,
      inscriptions_ouvertes: true,
      prorataMode: "MONTH" as const,
      accessRules: {
        bloquer_si_a_facturer: true,
        bloquer_si_en_attente_reglement: true,
        bloquer_si_suspension_financiere: true,
        autoriser_avant_date_debut: false,
        validation_humaine_suspension_financiere: false,
      },
    };
  }

  const payload = raw as Record<string, unknown>;
  const zones = Array.isArray(payload.zones)
    ? payload.zones
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item): item is string => Boolean(item))
    : [];
  const zoneTarifs =
    payload.zone_tarifs && typeof payload.zone_tarifs === "object" && !Array.isArray(payload.zone_tarifs)
      ? Object.entries(payload.zone_tarifs as Record<string, unknown>).reduce<Record<string, number>>(
          (acc, [key, value]) => {
            const label = key.trim();
            const amount = Number(value);
            if (label && Number.isFinite(amount) && amount >= 0) {
              acc[label] = amount;
            }
            return acc;
          },
          {},
        )
      : {};

  return {
    zones,
    zoneTarifs,
    inscriptions_ouvertes: payload.inscriptions_ouvertes !== false,
    prorataMode:
      payload.prorata_mode === "SCHOOL_YEAR" || payload.prorata_mode === "ANNEE_SCOLAIRE"
        ? "SCHOOL_YEAR"
        : "MONTH",
    accessRules: {
      bloquer_si_a_facturer:
        payload.bloquer_si_a_facturer === false || payload.bloquer_si_a_facturer === "false"
          ? false
          : true,
      bloquer_si_en_attente_reglement:
        payload.bloquer_si_en_attente_reglement === false ||
        payload.bloquer_si_en_attente_reglement === "false"
          ? false
          : true,
      bloquer_si_suspension_financiere:
        payload.bloquer_si_suspension_financiere === false ||
        payload.bloquer_si_suspension_financiere === "false"
          ? false
          : true,
      autoriser_avant_date_debut:
        payload.autoriser_avant_date_debut === true ||
        payload.autoriser_avant_date_debut === "true",
      validation_humaine_suspension_financiere:
        payload.validation_humaine_suspension_financiere === true ||
        payload.validation_humaine_suspension_financiere === "true",
    },
  };
}

class LigneTransportService extends Service {
  constructor() {
    super("ligne-transport");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ nom: "asc" }, { created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { etablissement_id: etablissementId };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default LigneTransportService;
