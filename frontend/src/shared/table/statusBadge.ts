const NORMALIZED_SUCCESS = new Set([
  "actif",
  "active",
  "valide",
  "validé",
  "validée",
  "payé",
  "payee",
  "payée",
  "paye",
  "approuve",
  "approuvé",
  "approuvée",
  "present",
  "présent",
  "tenue",
]);

const NORMALIZED_WARNING = new Set([
  "en attente",
  "attente",
  "partiel",
  "partielle",
  "retard",
  "en retard",
  "brouillon",
  "préinscrit",
  "preinscrit",
  "non facture",
  "non facturé",
]);

const NORMALIZED_DANGER = new Set([
  "inactif",
  "inactive",
  "suspendu",
  "suspendue",
  "annule",
  "annulé",
  "annulée",
  "rejete",
  "rejeté",
  "rejetée",
  "impaye",
  "impayé",
  "absent",
  "refuse",
  "refusé",
]);

const NORMALIZED_INFO = new Set(["publie", "publié", "publiée", "emise", "émise", "excuse", "excusé"]);

function normalizeStatus(status: unknown) {
  return String(status ?? "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

export function getStatusBadgeVariant(status: unknown) {
  const normalized = normalizeStatus(status);

  if (NORMALIZED_SUCCESS.has(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (NORMALIZED_WARNING.has(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (NORMALIZED_DANGER.has(normalized)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (NORMALIZED_INFO.has(normalized)) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function formatStatusLabel(status: unknown) {
  const raw = String(status ?? "").replace(/_/g, " ").trim();
  if (!raw) return "-";
  return raw.toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}
