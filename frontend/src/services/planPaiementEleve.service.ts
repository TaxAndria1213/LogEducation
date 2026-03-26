import Service from "../app/api/Service";
import type { AnneeScolaire, Eleve, PlanPaiementEleve, Remise } from "../types/models";

type QueryParams = Record<string, unknown>;

export type PlanEcheance = {
  id?: string;
  ordre?: number;
  libelle?: string | null;
  date: string;
  montant: number;
  statut?: string | null;
  note?: string | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  devise?: string | null;
  facture_id?: string | null;
};

export type PlanPaiementEleveWithRelations = PlanPaiementEleve & {
  eleve?: (Eleve & {
    utilisateur?: {
      profil?: {
        prenom?: string | null;
        nom?: string | null;
      } | null;
    } | null;
  }) | null;
  annee?: Pick<AnneeScolaire, "id" | "nom"> | null;
  remise?: Pick<Remise, "id" | "nom" | "type" | "valeur"> | null;
  plan_json?: {
    mode_paiement?: string | null;
    nombre_tranches?: number | null;
    devise?: string | null;
    notes?: string | null;
    echeances?: PlanEcheance[];
    [key: string]: unknown;
  } | null;
  echeances?: Array<{
    id: string;
    ordre: number;
    libelle?: string | null;
    date_echeance: string | Date;
    montant_prevu: number;
    montant_regle: number;
    montant_restant: number;
    statut: string;
    devise?: string | null;
    notes?: string | null;
    facture_id?: string | null;
  }> | null;
};

export function getPlanPaiementEcheances(record?: Partial<PlanPaiementEleveWithRelations> | null): PlanEcheance[] {
  const relational = Array.isArray(record?.echeances) ? record.echeances : null;
  if (relational && relational.length > 0) {
    return relational.map((item) => ({
      id: item.id,
      ordre: item.ordre,
      libelle: item.libelle ?? null,
      date:
        item.date_echeance instanceof Date
          ? item.date_echeance.toISOString().slice(0, 10)
          : String(item.date_echeance).slice(0, 10),
      montant:
        typeof item.montant_prevu === "number"
          ? item.montant_prevu
          : Number(item.montant_prevu ?? 0),
      statut: item.statut ?? null,
      note: item.notes ?? null,
      paid_amount:
        typeof item.montant_regle === "number"
          ? item.montant_regle
          : Number(item.montant_regle ?? 0),
      remaining_amount:
        typeof item.montant_restant === "number"
          ? item.montant_restant
          : Number(item.montant_restant ?? 0),
      devise: item.devise ?? null,
      facture_id: item.facture_id ?? null,
    }));
  }

  const direct = record?.plan_json?.echeances;
  if (Array.isArray(direct)) return direct;

  const nested = (record?.plan_json as { echeancier?: { premiere_echeance?: string | null; nombre_tranches?: number | null } } | undefined)?.echeancier;
  if (nested?.premiere_echeance) {
    return [
      {
        date: nested.premiere_echeance,
        montant: 0,
        statut: null,
        note: nested.nombre_tranches ? `${nested.nombre_tranches} tranche(s)` : null,
      },
    ];
  }

  return [];
}

function sumPlanField(
  record: Partial<PlanPaiementEleveWithRelations> | null | undefined,
  key: "montant" | "paid_amount" | "remaining_amount",
) {
  return getPlanPaiementEcheances(record).reduce((sum, item) => {
    const value = item[key];
    const amount =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : 0;
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

export function getPlanPaiementTotalAmount(record?: Partial<PlanPaiementEleveWithRelations> | null) {
  return sumPlanField(record, "montant");
}

export function getPlanPaiementPaidAmount(record?: Partial<PlanPaiementEleveWithRelations> | null) {
  return sumPlanField(record, "paid_amount");
}

export function getPlanPaiementRemainingAmount(record?: Partial<PlanPaiementEleveWithRelations> | null) {
  const direct = sumPlanField(record, "remaining_amount");
  if (direct > 0) return direct;
  return Math.max(0, getPlanPaiementTotalAmount(record) - getPlanPaiementPaidAmount(record));
}

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

export function getPlanPaiementDisplayLabel(record?: Partial<PlanPaiementEleveWithRelations> | null) {
  if (!record?.eleve) return "Plan de paiement";
  const prenom = record.eleve.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = record.eleve.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();
  return fullName || record.eleve.code_eleve?.trim() || "Plan de paiement";
}

export function getPlanPaiementSecondaryLabel(record?: Partial<PlanPaiementEleveWithRelations> | null) {
  if (!record) return "";
  const code = record.eleve?.code_eleve?.trim();
  const year = record.annee?.nom?.trim();
  const tranches = getPlanPaiementEcheances(record).length;
  return [code, year, tranches > 0 ? `${tranches} tranche${tranches > 1 ? "s" : ""}` : ""]
    .filter(Boolean)
    .join(" - ");
}

class PlanPaiementEleveService extends Service {
  constructor() {
    super("plan-paiement-eleve");
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

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { eleve: { is: { etablissement_id: etablissementId } } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default PlanPaiementEleveService;
