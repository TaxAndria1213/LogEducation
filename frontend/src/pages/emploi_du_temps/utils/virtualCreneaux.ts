import type { CreneauHoraire } from "../../../types/models";
import type { EmploiDuTempsWithRelations } from "../../../services/emploiDuTemps.service";

const VIRTUAL_CRENEAU_PREFIX = "__virtual_creneau__";

export function formatTime(totalMinutes: number): string {
  const hours = `${Math.floor(totalMinutes / 60)}`.padStart(2, "0");
  const minutes = `${totalMinutes % 60}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function toMinutes(value?: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

export function buildVirtualCreneaux(etablissementId: string): CreneauHoraire[] {
  const createdAt = new Date();
  const creneaux: CreneauHoraire[] = [];

  for (let minutes = 6 * 60, order = 1; minutes < 18 * 60; minutes += 30, order += 1) {
    const heureDebut = formatTime(minutes);
    const heureFin = formatTime(minutes + 30);

    creneaux.push({
      id: `${VIRTUAL_CRENEAU_PREFIX}${heureDebut.replace(":", "")}-${heureFin.replace(":", "")}`,
      etablissement_id: etablissementId,
      nom: `${heureDebut} - ${heureFin}`,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      ordre: order,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  return creneaux;
}

export function getCoveredVirtualCreneauIds(
  row: Pick<EmploiDuTempsWithRelations, "creneau_horaire_id" | "creneau" | "heure_debut" | "heure_fin">,
  virtualCreneaux: CreneauHoraire[],
): string[] {
  const rowStart = toMinutes(row.heure_debut ?? row.creneau?.heure_debut);
  const rowEnd = toMinutes(row.heure_fin ?? row.creneau?.heure_fin);

  if (rowStart == null || rowEnd == null) {
    return virtualCreneaux.some((item) => item.id === row.creneau_horaire_id)
      ? [row.creneau_horaire_id]
      : [];
  }

  return virtualCreneaux
    .filter((creneau) => {
      const start = toMinutes(creneau.heure_debut);
      const end = toMinutes(creneau.heure_fin);

      if (start == null || end == null) return false;
      return start < rowEnd && end > rowStart;
    })
    .map((creneau) => creneau.id);
}
