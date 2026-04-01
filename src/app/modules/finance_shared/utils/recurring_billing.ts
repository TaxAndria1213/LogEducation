import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type RecurringCycleInfo = {
  periodicite: string;
  cycleKey: string;
  cycleLabel: string;
};

function formatDateLabel(value: Date) {
  return value.toLocaleDateString("fr-FR");
}

function normalizeDateOnly(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("La date de cycle recurrente est invalide.");
  }
  return new Date(date.toISOString().slice(0, 10));
}

function getIsoWeek(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return {
    year: utcDate.getUTCFullYear(),
    week: weekNo,
  };
}

export async function resolveRecurringCycleInfo(
  prisma: DbClient,
  periodicite: string,
  anneeId: string,
  referenceDate: Date,
): Promise<RecurringCycleInfo> {
  switch ((periodicite ?? "").toLowerCase()) {
    case "daily":
      return {
        periodicite: "daily",
        cycleKey: referenceDate.toISOString().slice(0, 10),
        cycleLabel: formatDateLabel(referenceDate),
      };
    case "weekly": {
      const isoWeek = getIsoWeek(referenceDate);
      return {
        periodicite: "weekly",
        cycleKey: `${isoWeek.year}-W${String(isoWeek.week).padStart(2, "0")}`,
        cycleLabel: `Semaine ${isoWeek.week} - ${isoWeek.year}`,
      };
    }
    case "monthly":
      return {
        periodicite: "monthly",
        cycleKey: referenceDate.toISOString().slice(0, 7),
        cycleLabel: referenceDate.toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        }),
      };
    case "year":
      return {
        periodicite: "year",
        cycleKey: `YEAR:${anneeId}`,
        cycleLabel: `Annee scolaire ${anneeId}`,
      };
    case "term": {
      const periode = await prisma.periode.findFirst({
        where: {
          annee_scolaire_id: anneeId,
          date_debut: { lte: referenceDate },
          date_fin: { gte: referenceDate },
        },
        orderBy: [{ ordre: "asc" }],
      });

      if (!periode) {
        throw new Error("Impossible de determiner la periode scolaire pour cette facturation recurrente.");
      }

      return {
        periodicite: "term",
        cycleKey: `TERM:${periode.id}`,
        cycleLabel: periode.nom,
      };
    }
    case "semester": {
      const annee = await prisma.anneeScolaire.findUnique({
        where: { id: anneeId },
        select: { nom: true, date_debut: true },
      });

      if (!annee) {
        throw new Error("Impossible de determiner l'annee scolaire pour cette facturation recurrente.");
      }

      const start = normalizeDateOnly(referenceDate);
      const yearStart = normalizeDateOnly(annee.date_debut);
      const monthsDiff =
        (start.getUTCFullYear() - yearStart.getUTCFullYear()) * 12 +
        (start.getUTCMonth() - yearStart.getUTCMonth());
      const semesterIndex = monthsDiff >= 6 ? 2 : 1;

      return {
        periodicite: "semester",
        cycleKey: `SEMESTER:${anneeId}:${semesterIndex}`,
        cycleLabel: `Semestre ${semesterIndex} - ${annee.nom}`,
      };
    }
    default:
      throw new Error(`La periodicite ${periodicite} n'est pas prise en charge.`);
  }
}

export async function createRecurringExecutionIfNeeded(
  prisma: DbClient,
  args: {
    tenantId: string;
    eleveId: string;
    anneeScolaireId: string;
    factureId: string;
    catalogueFraisId: string | null | undefined;
    createdByUtilisateurId?: string | null;
    referenceDate: Date;
    runId?: string | null;
  },
) {
  if (!args.catalogueFraisId) return null;

  const catalogue = await prisma.catalogueFrais.findFirst({
    where: {
      id: args.catalogueFraisId,
      etablissement_id: args.tenantId,
      est_recurrent: true,
      statut_validation: "APPROUVEE",
      NOT: {
        periodicite: null,
      },
    } as never,
    select: {
      id: true,
      periodicite: true,
    },
  });

  if (!catalogue?.periodicite) return null;

  const cycle = await resolveRecurringCycleInfo(
    prisma,
    catalogue.periodicite,
    args.anneeScolaireId,
    args.referenceDate,
  );

  const existing = await prisma.facturationRecurrenteExecution.findFirst({
    where: {
      catalogue_frais_id: catalogue.id,
      eleve_id: args.eleveId,
      annee_scolaire_id: args.anneeScolaireId,
      cycle_key: cycle.cycleKey,
    },
    select: { id: true },
  });

  if (existing) return null;

  return prisma.facturationRecurrenteExecution.create({
    data: {
      run_id: args.runId ?? randomUUID(),
      etablissement_id: args.tenantId,
      catalogue_frais_id: catalogue.id,
      eleve_id: args.eleveId,
      annee_scolaire_id: args.anneeScolaireId,
      facture_id: args.factureId,
      created_by_utilisateur_id: args.createdByUtilisateurId ?? null,
      periodicite: cycle.periodicite,
      cycle_key: cycle.cycleKey,
      cycle_label: cycle.cycleLabel,
      date_reference: args.referenceDate,
    },
  });
}
