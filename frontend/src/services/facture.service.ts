import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type {
  AnneeScolaire,
  CatalogueFrais,
  Facture,
  FactureLigne,
  Paiement,
  Remise,
} from "../types/models";

type QueryParams = Record<string, unknown>;

export type FactureEcheance = {
  id: string;
  plan_paiement_id?: string | null;
  ordre: number;
  libelle?: string | null;
  date_echeance: string | Date;
  montant_prevu: number;
  montant_regle: number;
  montant_restant: number;
  statut: string;
  devise?: string | null;
  notes?: string | null;
  affectations?: Array<{
    id: string;
    paiement_id: string;
    montant: number;
  }>;
};

export type FactureWithRelations = Facture & {
  nature?: string | null;
  facture_origine_id?: string | null;
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
  annee?: Pick<AnneeScolaire, "id" | "nom"> | null;
  remise?: Pick<Remise, "id" | "nom" | "type" | "valeur"> | null;
  factureOrigine?: Pick<Facture, "id" | "numero_facture" | "statut" | "total_montant"> | null;
  avoirs?: Array<Pick<Facture, "id" | "numero_facture" | "statut" | "total_montant" | "created_at">>;
  lignes?: Array<
    FactureLigne & {
      frais?: Pick<CatalogueFrais, "id" | "nom" | "devise"> | null;
    }
  >;
  paiements?: Array<Paiement & { statut?: string | null }>;
  echeances?: FactureEcheance[];
  operationsFinancieres?: Array<{
    id: string;
    type: string;
    montant?: number | string | null;
    motif?: string | null;
    created_at?: string | Date;
    details_json?: Record<string, unknown> | null;
  }>;
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

export function getFactureStatusLabel(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "BROUILLON":
      return "Brouillon";
    case "EMISE":
      return "Emise";
    case "PARTIELLE":
      return "Partielle";
    case "PAYEE":
      return "Payee";
    case "ANNULEE":
      return "Annulee";
    case "EN_RETARD":
      return "En retard";
    default:
      return status ?? "Statut inconnu";
  }
}

export function getFactureNatureLabel(nature?: string | null) {
  switch ((nature ?? "FACTURE").toUpperCase()) {
    case "AVOIR":
      return "Avoir";
    case "FACTURE":
    default:
      return "Facture";
  }
}

export function getFactureDisplayLabel(record?: Partial<FactureWithRelations> | null) {
  if (!record) return "Facture non renseignee";
  return record.numero_facture?.trim() || "Facture sans numero";
}

export function getFactureStudentLabel(record?: Partial<FactureWithRelations> | null) {
  if (!record?.eleve) return "Eleve non renseigne";
  const prenom = record.eleve.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = record.eleve.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();
  return fullName || record.eleve.code_eleve?.trim() || "Eleve non renseigne";
}

export function getFactureSecondaryLabel(record?: Partial<FactureWithRelations> | null) {
  if (!record) return "";
  const student = getFactureStudentLabel(record);
  const code = record.eleve?.code_eleve?.trim();
  const year = record.annee?.nom?.trim();
  return [student, code && code !== student ? code : "", year].filter(Boolean).join(" - ");
}

class FactureService extends Service {
  constructor() {
    super("facture");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ date_emission: "desc" }, { created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  async cancel(id: string, payload: { motif?: string | null } = {}) {
    return Http.post(["/api", this.url, id, "cancel"].join("/"), payload);
  }

  async createAvoir(id: string, payload: { motif?: string | null; montant?: number | null } = {}) {
    return Http.post(["/api", this.url, id, "avoir"].join("/"), payload);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { etablissement_id: etablissementId };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default FactureService;
