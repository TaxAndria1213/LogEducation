import type { BlockMode, InitialisationPreviewBlock } from "./initial_setup.builder";

export type NewSchoolYearPayload = {
  etablissement_id: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  source_annee_id?: string;
  copy_periodes: boolean;
  close_current_year: boolean;
  references_mode: BlockMode;
  finance_mode: BlockMode;
  services_mode: BlockMode;
};

function toTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

function toBlockMode(value: unknown, fallback: BlockMode): BlockMode {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toUpperCase();
  const allowed: BlockMode[] = [
    "CREATION",
    "REPRISE",
    "REPRISE_MODIFIEE",
    "DESACTIVEE",
    "PLUS_TARD",
  ];
  return allowed.includes(normalized as BlockMode)
    ? (normalized as BlockMode)
    : fallback;
}

function buildBlock(
  code: string,
  libelle: string,
  mode: BlockMode,
  description: string,
  estimationCreation: number,
  executionDisponible: boolean,
): InitialisationPreviewBlock {
  return {
    code,
    libelle,
    mode,
    statut:
      mode === "DESACTIVEE"
        ? "IGNORE"
        : executionDisponible && mode !== "PLUS_TARD"
          ? "PRET"
          : "DIFFERE",
    description,
    estimation_creation: estimationCreation,
    execution_disponible: executionDisponible,
  };
}

export function normalizeNewSchoolYearPayload(body: unknown): NewSchoolYearPayload {
  const raw =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const etablissementId = toTrimmedString(raw.etablissement_id);
  const nom = toTrimmedString(raw.nom);
  const dateDebut = toTrimmedString(raw.date_debut);
  const dateFin = toTrimmedString(raw.date_fin);

  if (!etablissementId) {
    throw new Error("L'etablissement cible est obligatoire.");
  }

  if (!nom || !dateDebut || !dateFin) {
    throw new Error("Le nom et les bornes de la nouvelle annee scolaire sont obligatoires.");
  }

  return {
    etablissement_id: etablissementId,
    nom,
    date_debut: dateDebut,
    date_fin: dateFin,
    source_annee_id: toTrimmedString(raw.source_annee_id),
    copy_periodes: toBoolean(raw.copy_periodes, true),
    close_current_year: toBoolean(raw.close_current_year, true),
    references_mode: toBlockMode(raw.references_mode, "REPRISE"),
    finance_mode: toBlockMode(raw.finance_mode, "PLUS_TARD"),
    services_mode: toBlockMode(raw.services_mode, "PLUS_TARD"),
  };
}

export function buildNewSchoolYearPreviewBlocks(
  payload: NewSchoolYearPayload,
  sourcePeriodCount: number,
): InitialisationPreviewBlock[] {
  return [
    buildBlock(
      "ANNEE_SCOLAIRE",
      "Nouvelle annee scolaire",
      "CREATION",
      "Creation de la nouvelle annee scolaire cible.",
      1,
      true,
    ),
    buildBlock(
      "PERIODES",
      "Periodes academiques",
      payload.copy_periodes ? "REPRISE" : "PLUS_TARD",
      payload.copy_periodes
        ? "Reprise des periodes de l'annee source avec recalage sur les nouvelles dates."
        : "Les periodes seront recreees ou completees plus tard.",
      payload.copy_periodes ? sourcePeriodCount : 0,
      true,
    ),
    buildBlock(
      "REFERENCES_STABLES",
      "Referentiels stables",
      payload.references_mode,
      "Niveaux, departements, matieres et autres referentiels stables restent en place pour la nouvelle annee.",
      0,
      false,
    ),
    buildBlock(
      "FINANCE",
      "Frais et echeanciers",
      payload.finance_mode,
      "Le raccord finance est prevu dans l'assistant mais la duplication guidee reste a construire.",
      0,
      false,
    ),
    buildBlock(
      "SERVICES_ANNEXES",
      "Transport et cantine",
      payload.services_mode,
      "Les calendriers et references de services annexes sont prepares pour la prochaine passe.",
      0,
      false,
    ),
  ];
}
