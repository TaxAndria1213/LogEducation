import { Http } from "../app/api/Http";
import Service from "../app/api/Service";
import type { Bulletin, BulletinLigne, Classe, Periode } from "../types/models";
import type { MatiereWithRelations } from "./matiere.service";
import { getEleveDisplayLabel, type EleveWithRelations } from "./note.service";

type QueryParams = Record<string, unknown>;

export type BulletinLineWithRelations = BulletinLigne & {
  matiere?: MatiereWithRelations | null;
};

export type BulletinDisplayColumn = {
  key: string;
  label: string;
};

export type BulletinDisplayLine = {
  row_id: string;
  matiere_id: string;
  matiere_nom: string;
  pedagogical_item_id?: string | null;
  item_type?: string | null;
  depth?: number;
  is_summary_line?: boolean;
  moyenne: number | null;
  coefficient: number | null;
  points: number | null;
  rang: number | null;
  appreciation: string | null;
  display_cells: Record<string, string>;
};

export type BulletinDisplaySnapshot = {
  template: {
    template_type: "STANDARD" | "DETAILED" | "ASSESSMENT_TYPE_SUMMARY" | "FINAL_EXAM_ONLY" | "CUSTOM";
    show_absences: boolean;
    show_late_count: boolean;
    show_general_average: boolean;
    show_total_coefficients: boolean;
    show_total_points: boolean;
    show_general_rank: boolean;
    show_mention: boolean;
    show_decision: boolean;
    show_general_appreciation: boolean;
    show_logo: boolean;
    show_signature: boolean;
  };
  columns: BulletinDisplayColumn[];
  lines: BulletinDisplayLine[];
  summary: {
    general_average: number | null;
    total_coefficients: number;
    total_points: number;
    rank: number | null;
    mention: string | null;
    decision: string | null;
    general_appreciation: string | null;
    absence_count: number | null;
    late_count: number | null;
  };
  warnings: string[];
  generated_at: string;
};

export type BulletinWithRelations = Bulletin & {
  eleve?: EleveWithRelations | null;
  periode?: Pick<Periode, "id" | "nom" | "date_debut" | "date_fin" | "ordre"> | null;
  classe?: (Pick<Classe, "id" | "nom" | "annee_scolaire_id"> & {
    niveau?: {
      id: string;
      nom: string;
    } | null;
    site?: {
      id: string;
      nom: string;
    } | null;
  }) | null;
  lignes?: BulletinLineWithRelations[];
  affichage_bulletin?: BulletinDisplaySnapshot | null;
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

export function getBulletinAverage(lines?: BulletinLineWithRelations[] | null) {
  if (!lines || lines.length === 0) return null;

  const valid = lines.filter((line) => typeof line.moyenne === "number");
  if (valid.length === 0) return null;

  return Math.round((valid.reduce((sum, line) => sum + (line.moyenne ?? 0), 0) / valid.length) * 100) / 100;
}

export function getBulletinGeneralAverage(
  bulletin?: Partial<BulletinWithRelations> | null,
) {
  const snapshotAverage = bulletin?.affichage_bulletin?.summary?.general_average;
  if (typeof snapshotAverage === "number") {
    return snapshotAverage;
  }

  return getBulletinAverage(bulletin?.lignes);
}

export function getBulletinDisplayLabel(bulletin?: Partial<BulletinWithRelations> | null) {
  if (!bulletin) return "Bulletin non renseigne";

  const eleve = getEleveDisplayLabel(bulletin.eleve);
  const periode = bulletin.periode?.nom?.trim() ?? "";

  return periode ? `${eleve} - ${periode}` : eleve;
}

export function getBulletinSecondaryLabel(bulletin?: Partial<BulletinWithRelations> | null) {
  if (!bulletin) return "";

  const classe = bulletin.classe?.nom?.trim() ?? "";
  const lineCount =
    bulletin.affichage_bulletin?.lines?.length ??
    bulletin.lignes?.filter((line) => typeof line.moyenne === "number").length ??
    0;
  const statut = bulletin.statut?.trim() ?? "";
  const templateLabel = bulletin.affichage_bulletin?.template?.template_type
    ?.replaceAll("_", " ")
    .toLowerCase() ?? "";

  return [
    classe,
    lineCount > 0 ? `${lineCount} ligne(s)` : "",
    templateLabel ? `mode ${templateLabel}` : "",
    statut,
  ]
    .filter(Boolean)
    .join(" • ");
}

class BulletinService extends Service {
  constructor() {
    super("bulletin");
  }

  async generate(id: string) {
    return await Http.post(["/api", this.url, id, "generer"].join("/"), {});
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
          : JSON.stringify(params.orderBy ?? [{ created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = {
      classe: {
        etablissement_id: etablissementId,
      },
    };

    if (!parsedWhere || Object.keys(parsedWhere).length === 0) {
      return scope;
    }

    return {
      AND: [parsedWhere, scope],
    };
  }
}

export default BulletinService;

